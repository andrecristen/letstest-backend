import { PrismaClient } from "@prisma/client";
import { crypt } from "../src/utils/crypt.server";

const prisma = new PrismaClient();

const ApprovalStatus = {
  Draft: 1,
  Reviewed: 2,
  Approved: 3,
};

const ProjectVisibility = {
  Public: 1,
  Private: 2,
};

const ProjectSituation = {
  Testing: 1,
};

const InvolvementType = {
  Tester: 1,
  Manager: 2,
};

const EnvironmentSituation = {
  Operative: 1,
};

const TemplateType = {
  DefinitionTestCase: 1,
  ExecutionTestCase: 2,
  ExecutionTestScenario: 3,
};

const TagSituation = {
  Use: 1,
  DontUse: 2,
};

const ReportType = {
  Approved: 1,
  Rejected: 2,
};

const DeviceType = {
  Smartphone: 1,
  Notebook: 2,
  Desktop: 3,
  Tablet: 4,
};

const HabilityType = {
  Experience: 1,
  Certification: 2,
  Course: 3,
  Language: 4,
  SoftSkill: 5,
};

const makeRow = (id: number, columns: any[], minColumnCount = 1, maxColumnCount = 6) => ({
  id,
  minColumnCount,
  maxColumnCount,
  columns,
});

const makeColumn = (id: number, type: string, content: any, extra: Record<string, any> = {}) => ({
  id,
  type,
  content,
  ...extra,
});

const buildTableData = (rows: any[]) =>
  rows.reduce<Record<string, any>>((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});

const now = new Date();
const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);

declare const process: {
  env: Record<string, string | undefined>;
  exit: (code?: number) => void;
};

const makeId = (() => {
  let id = 1000;
  return () => {
    id += 1;
    return id;
  };
})();

async function resetDatabase() {
  await prisma.notificationRecipient.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.testExecution.deleteMany();
  await prisma.testCaseAssignment.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.testScenario.deleteMany();
  await prisma.environment.deleteMany();
  await prisma.tagValue.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.template.deleteMany();
  await prisma.involvement.deleteMany();
  await prisma.notificationSettings.deleteMany();
  await prisma.usageRecord.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.organizationInvite.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.webhookDelivery.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.project.deleteMany();
  await prisma.file.deleteMany();
  await prisma.device.deleteMany();
  await prisma.hability.deleteMany();
  await prisma.billingPlan.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  const shouldReset = process.env.SEED_RESET === "1" || process.env.SEED_RESET === "true";
  if (shouldReset) {
    await resetDatabase();
  }

  const passwordHash = await crypt.encrypt("123456");
  if (!passwordHash) {
    throw new Error("Failed to hash default password.");
  }

  const orgDemo = await prisma.organization.create({
    data: { name: "Letstest Demo", slug: "letstest-demo", plan: "free" },
  });

  const orgSandbox = await prisma.organization.create({
    data: { name: "QA Sandbox", slug: "qa-sandbox", plan: "pro" },
  });

  const orgLab = await prisma.organization.create({
    data: { name: "Lab Experimentos", slug: "lab-experimentos", plan: "enterprise" },
  });

  const sysAdmin = await prisma.user.create({
    data: {
      name: "System Admin",
      email: "admin@letstest.com",
      password: passwordHash,
      access: 99,
      bio: "Administrador do sistema com acesso total.",
      defaultOrgId: orgDemo.id,
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: "Andre Cristen",
      email: "andre@letstest.com",
      password: passwordHash,
      access: 1,
      bio: "Owner e gerente do projeto principal.",
      defaultOrgId: orgDemo.id,
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: "Marina Alves",
      email: "marina@letstest.com",
      password: passwordHash,
      access: 1,
      bio: "Gerente QA com foco em automacao.",
      defaultOrgId: orgDemo.id,
    },
  });

  const testers = [] as { id: number; name: string; email: string }[];
  const testerBase = [
    { name: "Lucas Silva", email: "lucas@letstest.com" },
    { name: "Paula Souza", email: "paula@letstest.com" },
    { name: "Renata Gomes", email: "renata@letstest.com" },
    { name: "Rafael Lima", email: "rafael@letstest.com" },
    { name: "Camila Duarte", email: "camila@letstest.com" },
    { name: "Thiago Costa", email: "thiago@letstest.com" },
    { name: "Vanessa Rocha", email: "vanessa@letstest.com" },
    { name: "Pedro Martins", email: "pedro@letstest.com" },
  ];

  for (const user of testerBase) {
    const created = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: passwordHash,
        access: 1,
        bio: "Testador ativo em multiplos projetos.",
        defaultOrgId: orgDemo.id,
      },
    });
    testers.push(created);
  }

  await prisma.organizationMember.createMany({
    data: [
      { organizationId: orgDemo.id, userId: sysAdmin.id, role: "owner" },
      { organizationId: orgDemo.id, userId: owner.id, role: "owner" },
      { organizationId: orgDemo.id, userId: manager.id, role: "admin" },
      ...testers.map((tester) => ({ organizationId: orgDemo.id, userId: tester.id, role: "member" })),
      { organizationId: orgSandbox.id, userId: owner.id, role: "owner" },
      { organizationId: orgSandbox.id, userId: manager.id, role: "admin" },
      { organizationId: orgLab.id, userId: owner.id, role: "owner" },
    ],
  });

  const subscription = await prisma.subscription.create({
    data: {
      organizationId: orgSandbox.id,
      plan: "pro",
      status: "active",
      currentPeriodStart: daysFromNow(-10),
      currentPeriodEnd: daysFromNow(20),
    },
  });

  await prisma.usageRecord.createMany({
    data: Array.from({ length: 12 }).map((_, index) => ({
      subscriptionId: subscription.id,
      metric: index % 2 === 0 ? "test_cases" : "executions",
      quantity: 50 + index * 7,
      recordedAt: daysFromNow(-index),
    })),
  });

  const habilityData = [
    { userId: manager.id, type: HabilityType.Experience, value: "6 anos QA" },
    { userId: manager.id, type: HabilityType.Certification, value: "ISTQB CTFL" },
    { userId: owner.id, type: HabilityType.Experience, value: "10 anos produto" },
    { userId: owner.id, type: HabilityType.SoftSkill, value: "Lideranca" },
    ...Array.from({ length: 18 }).map((_, index) => ({
      userId: owner.id,
      type: (index % 5) + 1,
      value: `Skill extra ${index + 1}`,
    })),
  ];

  testers.slice(0, 4).forEach((tester, index) => {
    habilityData.push({ userId: tester.id, type: HabilityType.Language, value: `Idioma ${index + 1}` });
    habilityData.push({ userId: tester.id, type: HabilityType.Course, value: `Curso ${index + 1}` });
  });

  await prisma.hability.createMany({
    data: habilityData,
  });

  const deviceData = [
    ...Array.from({ length: 20 }).map((_, index) => ({
      userId: owner.id,
      type: (index % 4) + 1,
      brand: index % 2 === 0 ? "Apple" : "Samsung",
      model: `Device ${index + 1}`,
      system: index % 2 === 0 ? "iOS 17" : "Android 14",
    })),
    ...Array.from({ length: 14 }).map((_, index) => ({
      userId: manager.id,
      type: (index % 4) + 1,
      brand: index % 2 === 0 ? "Dell" : "Lenovo",
      model: `Notebook ${index + 1}`,
      system: index % 2 === 0 ? "Windows 11" : "Ubuntu 22.04",
    })),
  ];

  testers.forEach((tester, index) => {
    Array.from({ length: 6 }).forEach((_, deviceIndex) => {
      deviceData.push({
        userId: tester.id,
        type: ((deviceIndex + index) % 4) + 1,
        brand: deviceIndex % 2 === 0 ? "Xiaomi" : "Motorola",
        model: `Tester ${index + 1} Device ${deviceIndex + 1}`,
        system: deviceIndex % 2 === 0 ? "Android 13" : "Android 14",
      });
    });
  });

  await prisma.device.createMany({
    data: deviceData,
  });

  const projectMain = await prisma.project.create({
    data: {
      name: "Plataforma Letstest",
      description: "Projeto principal com fluxo completo de QA.",
      visibility: ProjectVisibility.Private,
      situation: ProjectSituation.Testing,
      creatorId: owner.id,
      organizationId: orgDemo.id,
      approvalEnabled: true,
      approvalScenarioEnabled: true,
      approvalTestCaseEnabled: true,
      dueDate: daysFromNow(30),
    },
  });

  const projectPublic = await prisma.project.create({
    data: {
      name: "Landing Publica",
      description: "Projeto aberto para testar onboarding.",
      visibility: ProjectVisibility.Public,
      situation: ProjectSituation.Testing,
      creatorId: owner.id,
      organizationId: orgDemo.id,
      approvalEnabled: false,
      approvalScenarioEnabled: false,
      approvalTestCaseEnabled: false,
    },
  });

  const demoProjects = await Promise.all(
    Array.from({ length: 22 }).map((_, index) =>
      prisma.project.create({
        data: {
          name: `Projeto Demo ${index + 1}`,
          description: "Projeto de teste para scroll infinito.",
          visibility: index % 3 === 0 ? ProjectVisibility.Public : ProjectVisibility.Private,
          situation: ProjectSituation.Testing,
          creatorId: index % 2 === 0 ? owner.id : manager.id,
          organizationId: orgDemo.id,
          approvalEnabled: index % 2 === 0,
          approvalScenarioEnabled: index % 3 === 0,
          approvalTestCaseEnabled: true,
        },
      })
    )
  );

  await Promise.all(
    Array.from({ length: 8 }).map((_, index) =>
      prisma.project.create({
        data: {
          name: `Sandbox ${index + 1}`,
          description: "Area de experimentos QA.",
          visibility: ProjectVisibility.Private,
          situation: ProjectSituation.Testing,
          creatorId: manager.id,
          organizationId: orgSandbox.id,
          approvalEnabled: true,
          approvalScenarioEnabled: index % 2 === 0,
          approvalTestCaseEnabled: true,
        },
      })
    )
  );

  await Promise.all(
    Array.from({ length: 6 }).map((_, index) =>
      prisma.project.create({
        data: {
          name: `Lab ${index + 1}`,
          description: "Iniciativas enterprise.",
          visibility: ProjectVisibility.Private,
          situation: ProjectSituation.Testing,
          creatorId: owner.id,
          organizationId: orgLab.id,
          approvalEnabled: true,
          approvalScenarioEnabled: true,
          approvalTestCaseEnabled: true,
        },
      })
    )
  );

  await prisma.notificationSettings.createMany({
    data: [
      { projectId: projectMain.id, enableDeadlineWarning: true, deadlineWarningDays: 7 },
      { projectId: projectPublic.id, enableDeadlineWarning: true, deadlineWarningDays: 3 },
      ...demoProjects.slice(0, 6).map((project, index) => ({
        projectId: project.id,
        enableDeadlineWarning: true,
        deadlineWarningDays: index % 5,
      })),
    ],
  });

  await prisma.involvement.createMany({
    data: [
      { projectId: projectMain.id, userId: manager.id, type: InvolvementType.Manager },
      ...testers.map((tester) => ({
        projectId: projectMain.id,
        userId: tester.id,
        type: InvolvementType.Tester,
      })),
      { projectId: projectPublic.id, userId: testers[0].id, type: InvolvementType.Tester },
      { projectId: projectPublic.id, userId: testers[1].id, type: InvolvementType.Tester },
      { projectId: projectPublic.id, userId: manager.id, type: InvolvementType.Manager },
    ],
  });

  const demoInvolvements: Array<{ projectId: number; userId: number; type: number }> = [];
  demoProjects.slice(0, 10).forEach((project, index) => {
    demoInvolvements.push({ projectId: project.id, userId: manager.id, type: InvolvementType.Manager });
    demoInvolvements.push({
      projectId: project.id,
      userId: testers[index % testers.length].id,
      type: InvolvementType.Tester,
    });
    demoInvolvements.push({
      projectId: project.id,
      userId: testers[(index + 2) % testers.length].id,
      type: InvolvementType.Tester,
    });
  });

  await prisma.involvement.createMany({
    data: demoInvolvements,
  });

  const environments = await Promise.all(
    ["Staging", "Producao", "QA", "Homologacao"].map((name) =>
      prisma.environment.create({
        data: {
          projectId: projectMain.id,
          name,
          description: `Ambiente ${name.toLowerCase()} do projeto principal.`,
          situation: EnvironmentSituation.Operative,
        },
      })
    )
  );

  await prisma.environment.createMany({
    data: Array.from({ length: 26 }).map((_, index) => ({
      projectId: projectMain.id,
      name: `Env ${index + 1}`,
      description: `Ambiente adicional ${index + 1}.`,
      situation: EnvironmentSituation.Operative,
    })),
  });

  const priorityTag = await prisma.tag.create({
    data: {
      projectId: projectMain.id,
      organizationId: orgDemo.id,
      name: "Prioridade",
      situation: TagSituation.Use,
      commentary: "Nivel de prioridade do caso.",
    },
  });

  const priorityHigh = await prisma.tagValue.create({
    data: {
      projectId: projectMain.id,
      organizationId: orgDemo.id,
      tagId: priorityTag.id,
      name: "Alta",
      situation: TagSituation.Use,
      commentary: "Critico para release.",
    },
  });

  const priorityMedium = await prisma.tagValue.create({
    data: {
      projectId: projectMain.id,
      organizationId: orgDemo.id,
      tagId: priorityTag.id,
      name: "Media",
      situation: TagSituation.Use,
      commentary: "Importante, mas nao bloqueia release.",
    },
  });

  const extraTags = await Promise.all(
    Array.from({ length: 12 }).map((_, index) =>
      prisma.tag.create({
        data: {
          projectId: projectMain.id,
          organizationId: orgDemo.id,
          name: `Tag ${index + 1}`,
          situation: TagSituation.Use,
          commentary: "Tag criada para testar listagens.",
        },
      })
    )
  );

  const tagValueData: Array<{
    projectId: number;
    organizationId: number;
    tagId: number;
    name: string;
    situation: number;
  }> = [];

  extraTags.forEach((tag, tagIndex) => {
    Array.from({ length: 5 }).forEach((_, valueIndex) => {
      tagValueData.push({
        projectId: projectMain.id,
        organizationId: orgDemo.id,
        tagId: tag.id,
        name: `Valor ${tagIndex + 1}.${valueIndex + 1}`,
        situation: TagSituation.Use,
      });
    });
  });

  await prisma.tagValue.createMany({
    data: tagValueData,
  });

  const scenarioTemplateRows = [
    makeRow(1001, [
      makeColumn(1101, "Label", "Objetivo"),
      makeColumn(1102, "Texto Longo", "", { placeholder: "Descreva o objetivo do cenario" }),
    ]),
    makeRow(1002, [
      makeColumn(1201, "Label", "Pre-condicoes"),
      makeColumn(1202, "Texto Longo", "", { placeholder: "Pre-requisitos para executar o cenario" }),
    ]),
  ];

  const caseTemplateRows = [
    makeRow(2001, [
      makeColumn(2101, "Label", "Entradas"),
      makeColumn(2102, "Texto", "", { placeholder: "Dados de entrada" }),
      makeColumn(2103, "Campo Personalizado", priorityMedium.id, { tagId: priorityTag.id }),
    ]),
    makeRow(2002, [
      makeColumn(2201, "Label", "Resultado esperado"),
      makeColumn(2202, "Texto Longo", "", { placeholder: "Resultado esperado da execucao" }),
    ]),
  ];

  await prisma.template.createMany({
    data: [
      {
        projectId: projectMain.id,
        organizationId: orgDemo.id,
        name: "Definicao de Cenario",
        description: "Base para definir cenarios completos.",
        type: TemplateType.ExecutionTestScenario,
        data: buildTableData(scenarioTemplateRows),
      },
      {
        projectId: projectMain.id,
        organizationId: orgDemo.id,
        name: "Definicao de Caso",
        description: "Modelo padrao de caso de teste.",
        type: TemplateType.DefinitionTestCase,
        data: buildTableData(caseTemplateRows),
      },
      {
        projectId: projectMain.id,
        organizationId: orgDemo.id,
        name: "Execucao de Caso",
        description: "Checklist de execucao.",
        type: TemplateType.ExecutionTestCase,
        data: buildTableData([
          makeRow(3001, [
            makeColumn(3101, "Label", "Notas da execucao"),
            makeColumn(3102, "Texto Longo", "", { placeholder: "Observacoes" }),
          ]),
        ]),
      },
    ],
  });

  await prisma.template.createMany({
    data: Array.from({ length: 20 }).map((_, index) => ({
      projectId: projectMain.id,
      organizationId: orgDemo.id,
      name: `Template extra ${index + 1}`,
      description: "Template adicional para testes de scroll.",
      type: index % 2 === 0 ? TemplateType.DefinitionTestCase : TemplateType.ExecutionTestScenario,
      data: buildTableData([
        makeRow(makeId(), [
          makeColumn(makeId(), "Label", "Campo"),
          makeColumn(makeId(), "Texto Longo", `Descricao ${index + 1}`),
        ]),
      ]),
    })),
  });

  await prisma.template.createMany({
    data: Array.from({ length: 8 }).map((_, index) => ({
      organizationId: orgDemo.id,
      name: `Template org ${index + 1}`,
      description: "Template global da organizacao.",
      type: TemplateType.DefinitionTestCase,
      data: buildTableData([
        makeRow(makeId(), [
          makeColumn(makeId(), "Label", "Resumo"),
          makeColumn(makeId(), "Texto", `Org ${index + 1}`),
        ]),
      ]),
    })),
  });

  const scenarios = [] as { id: number; approved: boolean }[];
  for (let i = 0; i < 35; i += 1) {
    const approved = i % 3 === 0;
    const scenario = await prisma.testScenario.create({
      data: {
        projectId: projectMain.id,
        name: `Cenario ${i + 1}`,
        data: buildTableData([
          makeRow(makeId(), [
            makeColumn(makeId(), "Label", "Objetivo"),
            makeColumn(makeId(), "Texto Longo", `Objetivo do cenario ${i + 1}`),
          ]),
        ]),
        approvalStatus: approved ? ApprovalStatus.Approved : ApprovalStatus.Draft,
        approvedAt: approved ? now : undefined,
        approvedById: approved ? manager.id : undefined,
      },
    });
    scenarios.push({ id: scenario.id, approved });
  }

  const testCases = [] as { id: number }[];
  for (let i = 0; i < scenarios.length; i += 1) {
    if (!scenarios[i].approved) {
      continue;
    }
    for (let j = 0; j < 3; j += 1) {
      const testCase = await prisma.testCase.create({
        data: {
          projectId: projectMain.id,
          testScenarioId: scenarios[i].id,
          environmentId: environments[(i + j) % environments.length].id,
          name: `CT-${i + 1}-${j + 1}`,
          data: buildTableData([
            makeRow(makeId(), [
              makeColumn(makeId(), "Label", "Entradas"),
              makeColumn(makeId(), "Texto", `Entrada ${i + 1}.${j + 1}`),
              makeColumn(makeId(), "Campo Personalizado", j % 2 === 0 ? priorityHigh.id : priorityMedium.id, { tagId: priorityTag.id }),
            ]),
            makeRow(makeId(), [
              makeColumn(makeId(), "Label", "Resultado esperado"),
              makeColumn(makeId(), "Texto Longo", `Resultado esperado ${i + 1}.${j + 1}`),
            ]),
          ]),
          approvalStatus: j % 2 === 0 ? ApprovalStatus.Approved : ApprovalStatus.Draft,
          approvedAt: j % 2 === 0 ? now : undefined,
          approvedById: j % 2 === 0 ? manager.id : undefined,
          dueDate: daysFromNow(5 + j),
        },
      });
      testCases.push(testCase);
    }
  }

  const assignments = [] as { id: number; testCaseId: number }[];
  for (let i = 0; i < testCases.length; i += 1) {
    const tester = testers[i % testers.length];
    const assignment = await prisma.testCaseAssignment.create({
      data: {
        testCaseId: testCases[i].id,
        userId: tester.id,
        assignedById: manager.id,
        assignedAt: daysFromNow(-((i % 7) + 1)),
        startedAt: i % 4 === 0 ? daysFromNow(-(i % 5)) : undefined,
        lastPausedAt: i % 6 === 0 ? minutesAgo(30 + i) : undefined,
        finishedAt: i % 5 === 0 ? daysFromNow(-1) : undefined,
        totalPausedSeconds: i % 6 === 0 ? 300 : 0,
      },
    });
    assignments.push({ id: assignment.id, testCaseId: assignment.testCaseId });
  }

  const testExecutions = [] as { id: number }[];
  for (let i = 0; i < 28; i += 1) {
    const testCase = testCases[i % testCases.length];
    const tester = testers[i % testers.length];
    const testExecution = await prisma.testExecution.create({
      data: {
        testCaseId: testCase.id,
        userId: tester.id,
        deviceId: null,
        reported: daysFromNow(-(i % 5)),
        testTime: 1200 + i * 60,
        data: buildTableData([
          makeRow(makeId(), [
            makeColumn(makeId(), "Label", "Notas da execucao"),
            makeColumn(makeId(), "Texto Longo", `Execucao ${i + 1}`),
          ]),
        ]),
      },
    });
    testExecutions.push(testExecution);
  }

  const reportPayload: Array<{
    testExecutionId: number;
    userId: number;
    type: number;
    score: number;
    commentary: string;
  }> = [];

  testExecutions.forEach((execution, index) => {
    Array.from({ length: 6 }).forEach((_, reportIndex) => {
      reportPayload.push({
        testExecutionId: execution.id,
        userId: reportIndex % 2 === 0 ? manager.id : owner.id,
        type: reportIndex % 2 === 0 ? ReportType.Approved : ReportType.Rejected,
        score: 1 + ((index + reportIndex) % 5),
        commentary: `Relatorio ${index + 1}.${reportIndex + 1}`,
      });
    });
  });

  await prisma.report.createMany({ data: reportPayload });

  const notifications = await Promise.all(
    Array.from({ length: 30 }).map((_, index) =>
      prisma.notification.create({
        data: {
          type: 1,
          title: `Atualizacao ${index + 1}`,
          message: `Mensagem de notificacao ${index + 1}`,
          projectId: projectMain.id,
          organizationId: orgDemo.id,
          metadata: { index },
        },
      })
    )
  );

  const recipientPayload: Array<{
    notificationId: number;
    userId: number;
    readAt: Date | null;
  }> = [];

  notifications.forEach((notification, index) => {
    recipientPayload.push({
      notificationId: notification.id,
      userId: owner.id,
      readAt: index % 4 === 0 ? daysFromNow(-1) : null,
    });
    recipientPayload.push({
      notificationId: notification.id,
      userId: manager.id,
      readAt: index % 3 === 0 ? daysFromNow(-2) : null,
    });
  });

  await prisma.notificationRecipient.createMany({
    data: recipientPayload,
  });

  console.log("Seed concluido com sucesso.");
}

const run = async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

run();
