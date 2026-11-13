import { TrainingService } from './training.service';
import { TrainingAccessGuard } from './training.controller';
describe('review regressions', () => {
  it('refuses to publish a draft modified after the editor saved', async () => {
    const db: any = {
      trainingCourse: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ draft: {}, updatedAt: new Date('2026-01-02') }),
      },
    };
    db.$transaction = (fn: any) => fn(db);
    await expect(
      new TrainingService(db).publish('o', 'c', '2026-01-01T00:00:00.000Z'),
    ).rejects.toThrow('изменён');
  });
  it('requires edit permission to read unpublished draft keys', async () => {
    const service: any = {
      access: jest.fn(async (_u: any, _o: string, write: boolean) => {
        if (write) throw new Error('denied');
      }),
    };
    const guard = new TrainingAccessGuard(service);
    const req = {
      user: {},
      params: { organizationId: 'o', id: 'c' },
      method: 'GET',
      route: { path: 'organizations/:organizationId/training/:id' },
    };
    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => req }),
      } as any),
    ).rejects.toThrow();
  });
  it('rejects a missing physical media file before publishing', async () => {
    const db: any = {
      trainingMedia: {
        findFirst: jest.fn().mockResolvedValue({ mime: 'image/png' }),
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              filename: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png',
              mime: 'image/png',
            },
          ]),
      },
    };
    await expect(
      new TrainingService(db).ownedMedia('o', {
        blocks: [
          {
            id: 'b',
            type: 'image',
            url: '/api/training-media/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png',
          },
        ],
      } as any),
    ).rejects.toThrow();
  });
});
