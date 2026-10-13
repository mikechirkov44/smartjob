import { DragEvent, FormEvent, useRef, useState } from 'react';
import { api, ApiError, uploadFile } from '../api';
import { useAuth } from '../auth';
import { COVER_PRESETS, coverSrc, isUploadedCover } from '../coverPresets';
import {
  CATEGORY_OPTIONS,
  defaultGridColumns,
  defaultGridRows,
  EditorQuestion,
  emptyQuestion,
  METRIC_OPTIONS,
  newGridId,
  QUESTION_KIND_OPTIONS,
  QuestionKind,
  toApiQuestion,
} from '../questionOptions';
import { ConfirmDialog } from './ConfirmDialog';
import { CustomCheckbox } from './CustomCheckbox';
import { CustomDateTimePicker } from './CustomDateTimePicker';
import { CustomSelect } from './CustomSelect';
import './survey-editor.css';

export type SurveyFormState = {
  title: string;
  description: string;
  coverImage: string;
  template: string;
  includeEnps: boolean;
  hideQuestionCategory: boolean;
  adminCanIdentifyRespondents: boolean;
  closesAt: string;
};

type Props = {
  mode: 'create' | 'edit';
  initialForm: SurveyFormState;
  initialQuestions?: EditorQuestion[];
  surveyId?: string;
  allowQuestionEdit?: boolean;
  questionsLocked?: boolean;
  responseCount?: number;
  submitLabel: string;
  onSuccess: (surveyId: string) => void;
};

function ensureMetricOption(value: string) {
  if (METRIC_OPTIONS.some((o) => o.value === value)) return METRIC_OPTIONS;
  return [{ value, label: value }, ...METRIC_OPTIONS];
}

function ensureCategoryOption(value: string) {
  if (CATEGORY_OPTIONS.some((o) => o.value === value)) return CATEGORY_OPTIONS;
  return [{ value, label: value }, ...CATEGORY_OPTIONS];
}

function kindLabel(kind: QuestionKind) {
  return QUESTION_KIND_OPTIONS.find((o) => o.value === kind)?.label || kind;
}

export function SurveyEditor({
  mode,
  initialForm,
  initialQuestions = [emptyQuestion()],
  surveyId,
  allowQuestionEdit = true,
  questionsLocked = false,
  responseCount = 0,
  submitLabel,
  onSuccess,
}: Props) {
  const { token, organizationId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmSaveQuestions, setConfirmSaveQuestions] = useState(false);
  const [form, setForm] = useState<SurveyFormState>(initialForm);
  const [questions, setQuestions] = useState<EditorQuestion[]>(initialQuestions);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const willReplaceQuestions =
    mode === 'edit' && allowQuestionEdit && !questionsLocked;
  const warnAboutResponses = willReplaceQuestions && responseCount > 0;

  const updateQuestion = (idx: number, patch: Partial<EditorQuestion>) => {
    setQuestions((list) => list.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const reorderQuestions = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setQuestions((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const onQuestionDragStart = (idx: number) => (e: DragEvent) => {
    if (questionsLocked) return;
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const onQuestionDragOver = (idx: number) => (e: DragEvent) => {
    if (questionsLocked || dragIndex == null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== idx) setDragOverIndex(idx);
  };

  const onQuestionDrop = (idx: number) => (e: DragEvent) => {
    e.preventDefault();
    if (questionsLocked || dragIndex == null) return;
    reorderQuestions(dragIndex, idx);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const onQuestionDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const onUploadCover = async (file: File | undefined) => {
    if (!file || !organizationId) return;
    setUploading(true);
    setError('');
    try {
      const res = await uploadFile<{ coverImage: string }>(
        `/organizations/${organizationId}/uploads/cover`,
        file,
        { token, organizationId },
      );
      setForm((f) => ({ ...f, coverImage: res.coverImage }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveSurvey = async () => {
    if (!organizationId) return;
    setError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description || undefined,
        coverImage: form.coverImage,
        includeEnps: form.includeEnps,
        hideQuestionCategory: form.hideQuestionCategory,
        adminCanIdentifyRespondents: form.adminCanIdentifyRespondents,
        closesAt: form.closesAt ? form.closesAt : mode === 'edit' ? null : undefined,
      };

      if (mode === 'create') {
        body.template = form.template;
        if (form.template === 'CUSTOM') {
          body.questions = questions
            .filter((q) => q.text.trim())
            .map(toApiQuestion);
        }
        const survey = await api<{ id: string }>(
          `/organizations/${organizationId}/surveys`,
          { token, organizationId, method: 'POST', body },
        );
        onSuccess(survey.id);
        return;
      }

      if (willReplaceQuestions) {
        body.questions = questions.filter((q) => q.text.trim()).map(toApiQuestion);
      }
      await api(`/organizations/${organizationId}/surveys/${surveyId}`, {
        token,
        organizationId,
        method: 'PATCH',
        body,
      });
      setConfirmSaveQuestions(false);
      onSuccess(surveyId!);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка сохранения');
      setConfirmSaveQuestions(false);
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organizationId || saving) return;
    if (warnAboutResponses) {
      setConfirmSaveQuestions(true);
      return;
    }
    await saveSurvey();
  };

  const coverPresetLabel =
    COVER_PRESETS.find((p) => p.id === form.coverImage)?.label ||
    (isUploadedCover(form.coverImage) ? 'Свой файл' : 'Обложка');

  return (
    <>
    <form className="card stack survey-editor" onSubmit={(e) => void onSubmit(e)}>
      {warnAboutResponses && (
        <div className="error" role="status">
          По опросу уже есть ответы: {responseCount}. Сохранение состава вопросов
          удалит все результаты; сотрудники с персональными ссылками смогут пройти
          опрос заново.
        </div>
      )}
      <div className="survey-editor-section">
        <h3 className="survey-editor-section-title">Основное</h3>
        <div className="field">
          <label>Название</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Описание</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
      </div>

      <div className="survey-editor-section">
        <h3 className="survey-editor-section-title">Обложка</h3>
        <p className="survey-editor-section-sub">
          Выберите пресет или загрузите логотип / своё изображение.
        </p>
        <div className="survey-editor-preview">
          <img src={coverSrc(form.coverImage)} alt="" />
          <div>
            <strong>{coverPresetLabel}</strong>
            <span>Так обложку увидят участники опроса</span>
          </div>
        </div>
        <div className="cover-grid">
          {COVER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`cover-option ${form.coverImage === preset.id ? 'active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, coverImage: preset.id }))}
            >
              <img src={preset.src} alt={preset.label} />
              <span>{preset.label}</span>
            </button>
          ))}
          <button
            type="button"
            className={`cover-option upload ${isUploadedCover(form.coverImage) ? 'active' : ''}`}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {isUploadedCover(form.coverImage) ? (
              <img src={coverSrc(form.coverImage)} alt="Своя обложка" />
            ) : (
              <span className="cover-upload-placeholder">+</span>
            )}
            <span>{uploading ? 'Загрузка…' : 'Свой файл / логотип'}</span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          hidden
          onChange={(e) => void onUploadCover(e.target.files?.[0])}
        />
      </div>

      <div className="survey-editor-section">
        <h3 className="survey-editor-section-title">Параметры</h3>
        <div className="grid-2">
          {mode === 'create' ? (
            <div className="field">
              <label>Шаблон</label>
              <CustomSelect
                className="grow"
                value={form.template}
                placeholder="Шаблон"
                onChange={(template) =>
                  setForm((f) => ({
                    ...f,
                    template,
                    includeEnps: template === 'WORK_CONDITIONS' ? true : f.includeEnps,
                    coverImage:
                      template === 'WORK_CONDITIONS' ? 'work-conditions' : f.coverImage,
                  }))
                }
                options={[
                  { value: 'FULL', label: 'Полный (29 вопросов + eNPS)' },
                  { value: 'PULSE', label: 'Пульс (7 вопросов)' },
                  {
                    value: 'WORK_CONDITIONS',
                    label: 'Условия труда (21 вопрос, шкала 1–10)',
                  },
                  { value: 'CUSTOM', label: 'Свой опрос' },
                ]}
              />
            </div>
          ) : (
            <div className="field">
              <label>Шаблон</label>
              <input value={form.template} disabled readOnly />
            </div>
          )}
          <div className="field">
            <label>Дата закрытия</label>
            <CustomDateTimePicker
              value={form.closesAt}
              onChange={(closesAt) => setForm((f) => ({ ...f, closesAt }))}
              ariaLabel="Дата закрытия"
            />
          </div>
        </div>

        {form.template !== 'WORK_CONDITIONS' && (
          <CustomCheckbox
            variant="toggle"
            checked={form.includeEnps}
            onChange={(includeEnps) => setForm((f) => ({ ...f, includeEnps }))}
            label="Добавить eNPS"
          />
        )}
        {form.template === 'WORK_CONDITIONS' && (
          <p className="muted">
            Шаблон включает ФИО и открытые ответы (текст), шкалу 1–10 и вопрос о рекомендации
            компании (eNPS).
          </p>
        )}
        <CustomCheckbox
          variant="toggle"
          checked={form.hideQuestionCategory}
          onChange={(hideQuestionCategory) =>
            setForm((f) => ({ ...f, hideQuestionCategory }))
          }
          label="Скрывать категорию у респондента"
          description="Над вопросом не будет метки категории/метрики — только текст вопроса."
        />
        <CustomCheckbox
          variant="toggle"
          checked={form.adminCanIdentifyRespondents}
          onChange={(adminCanIdentifyRespondents) =>
            setForm((f) => ({ ...f, adminCanIdentifyRespondents }))
          }
          label="Админ может видеть, кто ответил"
          description="Только по персональным ссылкам. Для сотрудника опрос всегда выглядит анонимным."
        />
      </div>

      {allowQuestionEdit && (mode === 'edit' || form.template === 'CUSTOM') && (
        <div className="survey-editor-section">
          <h3 className="survey-editor-section-title">Конструктор вопросов</h3>
          <p className="survey-editor-section-sub">
            Текст, шкалы и сетка. Перетащите карточку за ⋮⋮, чтобы изменить порядок.
          </p>
          {questionsLocked && (
            <p className="muted">
              Вопросы можно менять только в статусе «Черновик». Сейчас опрос уже открыт или
              закрыт.
            </p>
          )}
          {questions.map((q, idx) => {
            const maxMark = q.kind === 'LIKERT_10' ? '10' : '5';
            const isScale = q.kind === 'LIKERT_5' || q.kind === 'LIKERT_10';
            return (
              <div
                className={[
                  'question-block',
                  dragIndex === idx ? 'dragging' : '',
                  dragOverIndex === idx && dragIndex !== idx ? 'drag-over' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                key={q.clientKey}
                onDragOver={onQuestionDragOver(idx)}
                onDrop={onQuestionDrop(idx)}
                onDragEnd={onQuestionDragEnd}
              >
                <div className="question-block-head">
                  <button
                    type="button"
                    className="question-drag-handle"
                    draggable={!questionsLocked}
                    disabled={questionsLocked}
                    aria-label={`Переместить вопрос ${idx + 1}`}
                    title="Перетащить"
                    onDragStart={onQuestionDragStart(idx)}
                  >
                    ⋮⋮
                  </button>
                  <span className="question-num">{idx + 1}</span>
                  <span className="question-kind-chip">{kindLabel(q.kind)}</span>
                </div>
                <div className="field">
                  <label>Текст вопроса</label>
                  <input
                    required
                    disabled={questionsLocked}
                    value={q.text}
                    onChange={(e) => updateQuestion(idx, { text: e.target.value })}
                  />
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label>Тип вопроса</label>
                    <CustomSelect
                      className="grow"
                      value={q.kind}
                      ariaLabel="Тип вопроса"
                      disabled={questionsLocked}
                      onChange={(kind) => {
                        const next = kind as QuestionKind;
                        updateQuestion(idx, {
                          kind: next,
                          ...(next === 'GRID'
                            ? {
                                gridRows:
                                  q.gridRows?.length ? q.gridRows : defaultGridRows(),
                                gridColumns:
                                  q.gridColumns?.length
                                    ? q.gridColumns
                                    : defaultGridColumns(),
                              }
                            : {}),
                        });
                      }}
                      options={QUESTION_KIND_OPTIONS}
                    />
                  </div>
                  <div className="field">
                    <label>Метрика</label>
                    <CustomSelect
                      className="grow"
                      value={q.metric}
                      ariaLabel="Метрика"
                      disabled={questionsLocked}
                      onChange={(metric) => updateQuestion(idx, { metric })}
                      options={ensureMetricOption(q.metric)}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Категория</label>
                  <CustomSelect
                    className="grow"
                    value={q.category}
                    ariaLabel="Категория"
                    disabled={questionsLocked}
                    onChange={(category) => updateQuestion(idx, { category })}
                    options={ensureCategoryOption(q.category)}
                  />
                </div>
                {isScale && (
                  <>
                    <div className="scale-label-preview">
                      <span>{q.scaleMinLabel.trim() || '1'}</span>
                      <span className="dots" aria-hidden />
                      <span>{q.scaleMaxLabel.trim() || maxMark}</span>
                    </div>
                    <div className="grid-2">
                      <div className="field">
                        <label>Подпись у 1</label>
                        <input
                          disabled={questionsLocked}
                          placeholder={
                            q.kind === 'LIKERT_10'
                              ? 'например: минимально'
                              : 'например: совершенно не согласен'
                          }
                          value={q.scaleMinLabel}
                          onChange={(e) =>
                            updateQuestion(idx, { scaleMinLabel: e.target.value })
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Подпись у {maxMark}</label>
                        <input
                          disabled={questionsLocked}
                          placeholder={
                            q.kind === 'LIKERT_10'
                              ? 'например: максимально'
                              : 'например: полностью согласен'
                          }
                          value={q.scaleMaxLabel}
                          onChange={(e) =>
                            updateQuestion(idx, { scaleMaxLabel: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
                {q.kind === 'GRID' && (
                  <div className="grid-builder">
                    <div className="grid-builder-col">
                      <div className="grid-builder-title">Строки</div>
                      {q.gridRows.map((row, rowIdx) => (
                        <div className="grid-builder-row" key={row.id}>
                          <span className="grid-builder-index">{rowIdx + 1}</span>
                          <input
                            disabled={questionsLocked}
                            placeholder="Название строки"
                            value={row.label}
                            onChange={(e) => {
                              const gridRows = q.gridRows.map((r, i) =>
                                i === rowIdx ? { ...r, label: e.target.value } : r,
                              );
                              updateQuestion(idx, { gridRows });
                            }}
                          />
                          {!questionsLocked && q.gridRows.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                updateQuestion(idx, {
                                  gridRows: q.gridRows.filter((_, i) => i !== rowIdx),
                                })
                              }
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      {!questionsLocked && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            updateQuestion(idx, {
                              gridRows: [
                                ...q.gridRows,
                                { id: newGridId('r'), label: '' },
                              ],
                            })
                          }
                        >
                          + Строка
                        </button>
                      )}
                    </div>
                    <div className="grid-builder-col">
                      <div className="grid-builder-title">Столбцы</div>
                      {q.gridColumns.map((col, colIdx) => (
                        <div className="grid-builder-row" key={col.id}>
                          <span className="grid-builder-index">{colIdx + 1}</span>
                          <input
                            disabled={questionsLocked}
                            placeholder="Подпись"
                            value={col.label}
                            onChange={(e) => {
                              const gridColumns = q.gridColumns.map((c, i) =>
                                i === colIdx ? { ...c, label: e.target.value } : c,
                              );
                              updateQuestion(idx, { gridColumns });
                            }}
                          />
                          <input
                            className="grid-builder-score"
                            disabled={questionsLocked}
                            type="number"
                            placeholder="балл"
                            title="Числовой балл для аналитики (пусто = без балла)"
                            value={col.value ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const gridColumns = q.gridColumns.map((c, i) =>
                                i === colIdx
                                  ? {
                                      ...c,
                                      value:
                                        raw === ''
                                          ? null
                                          : Number(raw),
                                    }
                                  : c,
                              );
                              updateQuestion(idx, { gridColumns });
                            }}
                          />
                          {!questionsLocked && q.gridColumns.length > 2 && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                updateQuestion(idx, {
                                  gridColumns: q.gridColumns.filter(
                                    (_, i) => i !== colIdx,
                                  ),
                                })
                              }
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      {!questionsLocked && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            updateQuestion(idx, {
                              gridColumns: [
                                ...q.gridColumns,
                                { id: newGridId('c'), label: '', value: null },
                              ],
                            })
                          }
                        >
                          + Столбец
                        </button>
                      )}
                    </div>
                    <CustomCheckbox
                      variant="toggle"
                      checked={q.requireAllRows}
                      onChange={(requireAllRows) =>
                        updateQuestion(idx, { requireAllRows })
                      }
                      label="Требовать ответ во всех строках"
                      disabled={questionsLocked}
                    />
                  </div>
                )}
                {!questionsLocked && questions.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm question-remove"
                    onClick={() =>
                      setQuestions((list) => list.filter((_, i) => i !== idx))
                    }
                  >
                    Удалить вопрос
                  </button>
                )}
              </div>
            );
          })}
          {!questionsLocked && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setQuestions((q) => [...q, emptyQuestion()])}
            >
              + Вопрос
            </button>
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}
      <div className="survey-editor-actions">
        <button className="btn btn-primary" disabled={uploading || saving}>
          {saving ? 'Сохранение…' : submitLabel}
        </button>
      </div>
    </form>

    <ConfirmDialog
      open={confirmSaveQuestions}
      danger
      busy={saving}
      title="Удалить все ответы?"
      message={`По опросу уже собрано ответов: ${responseCount}. Сохранение нового состава вопросов удалит все результаты безвозвратно. Аналитика обнулится. Продолжить?`}
      confirmLabel="Сохранить и удалить ответы"
      cancelLabel="Отмена"
      onCancel={() => {
        if (!saving) setConfirmSaveQuestions(false);
      }}
      onConfirm={() => void saveSurvey()}
    />
    </>
  );
}
