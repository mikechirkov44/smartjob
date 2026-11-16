const {
  reworkContent,
} = require('../../../../ops/rework-training-content.cjs');
describe('course rework migration', () => {
  const before = {
    title: 'Course',
    questions: [
      {
        id: 'q',
        subject: 'Old',
        body: 'Original',
        explanation: 'Why',
        phishing: true,
      },
    ],
    blocks: [{ id: 'rules', text: 'Old guide' }],
  };
  const after = {
    ...before,
    questions: [
      {
        ...before.questions[0],
        type: 'single',
        options: [
          { id: 'a', text: 'Yes' },
          { id: 'b', text: 'No' },
        ],
        correctOptionIds: ['a'],
      },
    ],
    blocks: [{ id: 'rules', text: 'New guide' }],
  };
  it('reworks matching assignments while preserving custom title and metadata', () => {
    const current = { ...before, title: 'My edited title', passMark: 90 };
    const result = reworkContent(current, before, after);
    expect(result.questions[0].type).toBe('single');
    expect(result.title).toBe('My edited title');
    expect(result.passMark).toBe(90);
    expect(before.questions[0]).not.toHaveProperty('type');
  });
  it('preserves edited tasks and custom lesson blocks', () => {
    const current = {
      ...before,
      questions: [{ ...before.questions[0], body: 'My task' }],
      blocks: [{ id: 'rules', text: 'My guide' }],
    };
    expect(reworkContent(current, before, after)).toEqual(current);
  });
  it('is idempotent', () => {
    expect(reworkContent(after, before, after)).toEqual(after);
  });
});

it('matches a published revision independently of a replaced draft',()=>{const {reworkForMappings}=require('../../../../ops/rework-training-content.cjs');const before={title:'Known',questions:[{id:'known',body:'old'}],blocks:[]};const after={...before,questions:[{id:'known',body:'new',type:'single'}]};const mapping=[{before,after}];const custom={title:'Renamed',questions:[{id:'custom',body:'mine'}],blocks:[]};expect(reworkForMappings(custom,mapping)).toEqual(custom);expect(reworkForMappings(before,mapping)).toEqual(after);});
