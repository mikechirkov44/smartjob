// Run with `docker exec -i smartjob-api node < ops/seed-training.cjs` after migration.
const {PrismaClient}=require('@prisma/client');
const {randomBytes}=require('crypto');
const {phishingTemplate}=require('./dist/training/phishing-template');
const db=new PrismaClient();
(async()=>{let created=0;for(const org of await db.organization.findMany({where:{isActive:true},select:{id:true}})){if(await db.trainingCourse.count({where:{organizationId:org.id}}))continue;const content=phishingTemplate();await db.trainingCourse.create({data:{organizationId:org.id,title:content.title,draft:content,token:randomBytes(24).toString('hex')}});created++;}console.log('Initial training drafts created: '+created);})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
