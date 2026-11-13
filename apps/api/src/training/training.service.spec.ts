import { TrainingService } from './training.service';
import { phishingTemplate } from './phishing-template';
const user: any = {
  globalRole: 'USER',
  memberships: [{ organizationId: 'org-a', role: 'HR' }],
};
function setup() {
  const revision = {
    id: 'r',
    version: 1,
    content: phishingTemplate(),
    course: { id: 'c', status: 'ACTIVE', organizationId: 'org-a' },
  };
  const attempt: any = {
    id: 'a',
    token: 'secret',
    revisionId: 'r',
    revision,
    answers: [],
    participantName: 'Иван Иванов',
    completedAt: null,
  };
  const db: any = {
    organization: {
      findUnique: jest.fn().mockResolvedValue({ isActive: true }),
    },
    trainingCourse: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'c',
        organizationId: 'org-a',
        status: 'ACTIVE',
        draft: phishingTemplate(),
      }),
      findUnique: jest
        .fn()
        .mockResolvedValue({ ...revision.course, publishedVersion: 1 }),
    },
    trainingRevision: { findUnique: jest.fn().mockResolvedValue(revision) },
    trainingAttempt: {
      findUnique: jest.fn().mockResolvedValue(attempt),
      create: jest.fn().mockResolvedValue(attempt),
      update: jest
        .fn()
        .mockImplementation(({ data }: any) => ({ ...attempt, ...data })),
    },
    trainingAnswer: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        attempt.answers.push(data);
        return data;
      }),
    },
  };
  db.$transaction = jest.fn(async (fn: any) => fn(db));
  return { service: new TrainingService(db), db, attempt };
}
describe('TrainingService', () => {
  it('rejects cross-organization path even if guard header could be spoofed', async () => {
    const { service } = setup();
    await expect(service.access(user, 'org-b', true)).rejects.toThrow();
  });
  it('rejects viewer mutation', async () => {
    const { service } = setup();
    await expect(
      service.access(
        { ...user, memberships: [{ organizationId: 'org-a', role: 'VIEWER' }] },
        'org-a',
        true,
      ),
    ).rejects.toThrow();
  });
  it('rejects blank participant name', async () => {
    const { service } = setup();
    await expect(service.start('link', '   ')).rejects.toThrow();
  });
  it('rejects closed course', async () => {
    const { service, db } = setup();
    db.trainingCourse.findUnique.mockResolvedValue({ status: 'CLOSED' });
    await expect(service.start('link', 'Иван Иванов')).rejects.toThrow();
  });
  it('does not leak future answers', async () => {
    const { service } = setup();
    const result = await service.attempt('secret');
    expect(result.content.questions[0]).not.toHaveProperty('phishing');
    expect(result.content.questions[0]).not.toHaveProperty('explanation');
  });
  it('rejects skipping questions', async () => {
    const { service } = setup();
    await expect(service.answer('secret', 'phish-2', true)).rejects.toThrow();
  });
  it('returns stored answer on duplicate, never changes first choice', async () => {
    const { service, db } = setup();
    const first = await service.answer('secret', 'phish-1', true);
    const second = await service.answer('secret', 'phish-1', false);
    expect(second).toEqual(first);
    expect(db.trainingAnswer.create).toHaveBeenCalledTimes(1);
  });
  it('rejects incomplete completion', async () => {
    const { service } = setup();
    await expect(service.complete('secret')).rejects.toThrow();
  });
});
