import { useNavigate } from 'react-router-dom';
import { SurveyEditor } from '../components/SurveyEditor';

export function SurveyCreatePage() {
  const navigate = useNavigate();

  return (
    <div className="stack page-enter">
      <div>
        <h1 className="page-title">Новый опрос</h1>
        <p className="page-sub">Выберите шаблон или соберите свой.</p>
      </div>
      <SurveyEditor
        mode="create"
        submitLabel="Создать опрос"
        initialForm={{
          title: '',
          description: '',
          coverImage: 'team-collab',
          template: 'FULL',
          includeEnps: true,
          hideQuestionCategory: false,
          showAnonymousNotice: true,
          adminCanIdentifyRespondents: false,
          closesAt: '',
        }}
        onSuccess={(id) => navigate(`/surveys/${id}`)}
      />
    </div>
  );
}
