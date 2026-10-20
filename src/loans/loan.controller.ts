// src/loans/loan.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/enums/permission.enum.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import {
  AddAssigneeDto,
  CreateCommentDto,
  CreateLoanDto,
  DecisionDto,
  ListLoansDto,
  RegisterDocumentDto,
  UpdateLoanDto,
} from './dto/loan.dto.js';
import { LoansService } from './loans.service.js';

@Controller('loans')
export class LoanController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @RequirePermissions(Permission.LOAN_CREATE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateLoanDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.loansService.create(dto, actor);
  }

  @Get()
  @RequirePermissions(Permission.LOAN_VIEW)
  findAll(@Query() query: ListLoansDto) {
    return this.loansService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.LOAN_VIEW)
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.loansService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.LOAN_EDIT)
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateLoanDto) {
    return this.loansService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.LOAN_DELETE_DRAFT)
  removeDraft(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.loansService.removeDraft(id);
  }

  @Post(':id/submit')
  @RequirePermissions(Permission.LOAN_SUBMIT)
  @HttpCode(HttpStatus.OK)
  submit(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.loansService.submit(id, actor);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.LOAN_APPROVE)
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.loansService.approve(id, actor, dto.notes);
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.LOAN_REJECT)
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.loansService.reject(id, actor, dto.notes);
  }

  // ---- Comments ---------------------------------------------------------

  @Post(':id/comments')
  @RequirePermissions(Permission.LOAN_COMMENT)
  addComment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.loansService.addComment(id, dto, actor);
  }

  @Get(':id/comments')
  @RequirePermissions(Permission.LOAN_VIEW)
  listComments(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.loansService.listComments(id);
  }

  // ---- Documents --------------------------------------------------------
  @Post(':id/documents')
  @RequirePermissions(Permission.DOC_UPLOAD)
  @HttpCode(HttpStatus.CREATED)
  registerDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RegisterDocumentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.loansService.registerDocument(id, dto, actor);
  }

  @Get(':id/documents/:documentId/download')
  @RequirePermissions(Permission.DOC_DOWNLOAD)
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    
  ) {
    const document = await this.loansService.getDocument(id, documentId);

    return {
      document,
      downloadUrl: `/storage/${encodeURIComponent(document.storageKey)}`,
      expiresInSeconds: 300,
    };
  }

  // ---- Assignees --------------------------------------------------------
  @Post(':id/assignees')
  @RequirePermissions(Permission.ASSIGNEE_ADD)
  @HttpCode(HttpStatus.CREATED)
  addAssignee(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddAssigneeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.loansService.addAssignee(id, dto, actor);
  }

  @Get(':id/assignees')
  @RequirePermissions(Permission.LOAN_VIEW)
  listAssignees(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.loansService.listAssignees(id);
  }

  @Delete(':id/assignees/:assigneeId')
  @RequirePermissions(Permission.ASSIGNEE_REMOVE)
  removeAssignee(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('assigneeId', new ParseUUIDPipe()) assigneeId: string,
  ) {
    return this.loansService.removeAssignee(id, assigneeId);
  }
}
