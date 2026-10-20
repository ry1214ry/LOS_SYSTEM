
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { UsersService } from '../users/users.service.js';
import { LoanApplication } from './entities/loan-application.entity.js';
import { LoanAssignee } from './entities/loan-assignee.entity.js';
import { LoanComment } from './entities/loan-comment.entity.js';
import { LoanDocument } from './entities/loan-document.entity.js';
import { LoanStatus } from './enums/loan-status.enum.js';
import {
  AddAssigneeDto,
  CreateCommentDto,
  CreateLoanDto,
  ListLoansDto,
  RegisterDocumentDto,
  UpdateLoanDto,
} from './dto/loan.dto.js';


@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    @InjectRepository(LoanApplication)
    private readonly loans: Repository<LoanApplication>,
    @InjectRepository(LoanComment)
    private readonly comments: Repository<LoanComment>,
    @InjectRepository(LoanDocument)
    private readonly documents: Repository<LoanDocument>,
    @InjectRepository(LoanAssignee)
    private readonly assignees: Repository<LoanAssignee>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateLoanDto, actor: AuthenticatedUser): Promise<LoanApplication> {
    const loan = this.loans.create({
      ...dto,
      currency: dto.currency?.toUpperCase() ?? 'USD',
      status: LoanStatus.DRAFT,
      createdById: actor.userId,
      assignedToId: dto.assignedToId ?? null,
      reference: await this.nextReference(),
    });
    return this.loans.save(loan);
  }
  

  async findAll(query: ListLoansDto): Promise<{ items: LoanApplication[]; total: number }> {
    const [items, total] = await this.loans.findAndCount({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
        ...(query.createdById ? { createdById: query.createdById } : {}),
      },
      order: { createdAt: 'DESC' },
      take: query.limit ?? 20,
      skip: query.offset ?? 0,
    });
    return { items, total };
  }

  async findOne(id: string): Promise<LoanApplication> {
    const loan = await this.loans.findOne({ where: { id } });
    if (!loan) throw new NotFoundException(`No loan application with id '${id}'.`);
    return loan;
  }

  /** Editing is only meaningful while the application is still a draft. */
  async update(id: string, dto: UpdateLoanDto): Promise<LoanApplication> {
    const loan = await this.findOne(id);
    if (loan.status !== LoanStatus.DRAFT) {
      throw new BadRequestException('Only draft applications can be edited.');
    }
    Object.assign(loan, dto);
    return this.loans.save(loan);
  }

  async removeDraft(id: string): Promise<{ message: string }> {
    const loan = await this.findOne(id);
    if (loan.status !== LoanStatus.DRAFT) {
      throw new BadRequestException('Only draft applications can be deleted.');
    }
    await this.loans.remove(loan);
    return { message: `Draft application ${id} deleted.` };
  }

  async submit(id: string, actor: AuthenticatedUser): Promise<LoanApplication> {
    const loan = await this.findOne(id);
    if (loan.status !== LoanStatus.DRAFT) {
      throw new ConflictException('Only draft applications can be submitted.');
    }
    loan.status = LoanStatus.SUBMITTED;
    loan.submittedById = actor.userId;
    loan.submittedAt = new Date();
    return this.loans.save(loan);
  }

  async approve(id: string, actor: AuthenticatedUser, notes?: string): Promise<LoanApplication> {
    return this.decide(id, actor, LoanStatus.APPROVED, notes);
  }

  async reject(id: string, actor: AuthenticatedUser, notes?: string): Promise<LoanApplication> {
    return this.decide(id, actor, LoanStatus.REJECTED, notes);
  }

  private async decide(
    id: string,
    actor: AuthenticatedUser,
    status: LoanStatus,
    notes?: string,
  ): Promise<LoanApplication> {
    const loan = await this.findOne(id);
    if (loan.createdById === actor.userId) {
      // Separation of duties: never let a decision maker approve their own file.
      throw new ForbiddenException('You cannot decide on an application you created.');
    }
    if (loan.status !== LoanStatus.SUBMITTED && loan.status !== LoanStatus.UNDER_REVIEW) {
      throw new ConflictException('Only submitted applications can be decided on.');
    }
    loan.status = status;
    loan.decidedById = actor.userId;
    loan.decidedAt = new Date();
    loan.decisionNotes = notes ?? null;
    return this.loans.save(loan);
  }

  // ---- Comments ---------------------------------------------------------
  async addComment(
    id: string,
    dto: CreateCommentDto,
    actor: AuthenticatedUser,
  ): Promise<LoanComment> {
    await this.findOne(id);
    return this.comments.save(
      this.comments.create({ loanId: id, authorId: actor.userId, body: dto.body }),
    );
  }

  async listComments(id: string): Promise<LoanComment[]> {
    await this.findOne(id);
    return this.comments.find({ where: { loanId: id }, order: { createdAt: 'ASC' } });
  }

  // ---- Documents --------------------------------------------------------
  async registerDocument(
    id: string,
    dto: RegisterDocumentDto,
    actor: AuthenticatedUser,
  ): Promise<LoanDocument> {
    await this.findOne(id);
    return this.documents.save(
      this.documents.create({
        loanId: id,
        uploadedById: actor.userId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: String(dto.sizeBytes),
        storageKey: dto.storageKey,
      }),
    );
  }

  async getDocument(id: string, documentId: string): Promise<LoanDocument> {
    const document = await this.documents.findOne({ where: { id: documentId, loanId: id } });
    if (!document) {
      throw new NotFoundException(`No document '${documentId}' on application '${id}'.`);
    }
    return document;
  }

  // ---- Assignees --------------------------------------------------------
  async addAssignee(
    id: string,
    dto: AddAssigneeDto,
    actor: AuthenticatedUser,
  ): Promise<LoanAssignee> {
    await this.findOne(id);
    // Validate the target user up-front so a bad id is a clean 404 instead of
    // a foreign-key violation surfacing as a 500.
    const user = await this.usersService.findById(dto.userId);
    if (!user) {
      throw new NotFoundException(`No user with id '${dto.userId}'.`);
    }

    const existing = await this.assignees.findOne({
      where: { loanId: id, userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('User is already assigned to this application.');
    }
    return this.assignees.save(
      this.assignees.create({ loanId: id, userId: dto.userId, assignedById: actor.userId }),
    );
  }

  async removeAssignee(id: string, assigneeId: string): Promise<{ message: string }> {
    const assignee = await this.assignees.findOne({ where: { id: assigneeId, loanId: id } });
    if (!assignee) {
      throw new NotFoundException(`No assignee '${assigneeId}' on application '${id}'.`);
    }
    await this.assignees.remove(assignee);
    return { message: `Assignee ${assigneeId} removed from application ${id}.` };
  }

  async listAssignees(id: string): Promise<LoanAssignee[]> {
    await this.findOne(id);
    return this.assignees.find({ where: { loanId: id }, order: { createdAt: 'ASC' } });
  }

  /**
   * Monotonic, human-friendly reference. The unique index on `reference` is the
   * real guard against collisions; the retry loop absorbs the rare race.
   */
  private async nextReference(): Promise<string> {
    const year = new Date().getFullYear();
    const [{ count }] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM loan_applications WHERE "reference" LIKE $1`,
      [`LOS-${year}-%`],
    )) as Array<{ count: number }>;

    let sequence = count + 1;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reference = `LOS-${year}-${String(sequence).padStart(6, '0')}`;
      const clash = await this.loans.exists({ where: { reference } });
      if (!clash) return reference;
      sequence += 1;
    }
    throw new ConflictException('Could not allocate a unique loan reference.');
  }
}
