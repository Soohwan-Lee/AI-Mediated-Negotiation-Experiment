/* eslint-disable @typescript-eslint/no-unused-expressions */
async (page) => {
  const origin = "http://localhost:3141";
  const policies = ["user_specified", "ai_supplemented"];
  const roles = ["leader", "member"];
  const sequences = {
    seq1: [["direct", "task_a"], [null, "task_b"]],
    seq2: [[null, "task_a"], ["direct", "task_b"]],
    seq3: [["direct", "task_b"], [null, "task_a"]],
    seq4: [[null, "task_b"], ["direct", "task_a"]],
  };
  let assignment;
  const escaped = [];

  await page.context().addInitScript(() => {
    const add = window.addEventListener.bind(window);
    window.addEventListener = (type, listener, options) => {
      if (type !== "beforeunload") add(type, listener, options);
    };
  });

  await page.context().route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.startsWith(`${origin}/`) && !url.startsWith("data:") && !url.startsWith("blob:")) {
      escaped.push(url);
      return route.abort("blockedbyclient");
    }
    const pathname = url.startsWith(origin)
      ? url.slice(origin.length).split("?")[0]
      : "";
    if (pathname === "/api/assign") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ assignment, status: "active", consented: true }),
      });
    }
    if (pathname === "/api/persist") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: null }),
      });
    }
    if (pathname.startsWith("/api/")) return route.abort("blockedbyclient");
    return route.continue();
  });

  assignment = {
    participantKey: "P-browser-correction",
    proxyPolicy: "user_specified",
    role: "member",
    sequenceId: "seq2",
    sessionOrder: "proxy_first",
    sessions: sequences.seq2.map(([condition, taskId], index) => ({
      index: index + 1,
      condition: condition || "user_specified",
      taskId,
    })),
    assignedAt: "2026-09-11T00:00:00.000Z",
  };
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${origin}/instruction`, { waitUntil: "domcontentloaded" });
  for (
    let pageIndex = 0;
    pageIndex < 8 && await page.getByRole("button", { name: "Continue to the quick check" }).count() === 0;
    pageIndex += 1
  ) {
    await page.getByRole("button", { name: /^Next:/ }).click();
  }
  await page.getByRole("button", { name: "Continue to the quick check" }).click();
  await page.getByRole("radio", { name: "The Member", exact: true }).check();
  await page.getByRole("radio", { name: "No", exact: true }).nth(0).check();
  await page.getByRole("radio", { name: "No", exact: true }).nth(1).check();
  await page.getByRole("radio", { name: /Sharing it is optional/ }).check();
  await page.getByRole("button", { name: "Check answers" }).click();
  const pendingBeforeCorrection = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("amne:check-gate:P-browser-correction:common"))?.status,
  );
  await page.getByRole("radio", { name: "The Leader", exact: true }).check();
  await page.getByRole("button", { name: "Next: the practice round" }).click();
  await page.waitForURL(`${origin}/practice/1`);
  const passedAfterCorrection = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("amne:check-gate:P-browser-correction:common"))?.status,
  );
  if (pendingBeforeCorrection !== "pending" || passedAfterCorrection !== "passed") {
    throw new Error(`Direct correction did not close the common gate: ${pendingBeforeCorrection} -> ${passedAfterCorrection}`);
  }

  const results = [];
  let cell = 0;
  for (const policy of policies) for (const role of roles) {
    for (const [sequenceId, sequence] of Object.entries(sequences)) {
      cell += 1;
      const participantKey = `P-route-${cell}`;
      const sessions = sequence.map(([condition, taskId], index) => ({
        index: index + 1,
        condition: condition || policy,
        taskId,
      }));
      assignment = {
        participantKey,
        proxyPolicy: policy,
        role,
        sequenceId,
        sessionOrder: ["seq1", "seq3"].includes(sequenceId) ? "direct_first" : "proxy_first",
        sessions,
        assignedAt: "2026-09-11T00:00:00.000Z",
      };

      for (const taskIndex of [1, 2]) {
        const view = await page.context().newPage();
        await view.addInitScript(({ key, index }) => {
          localStorage.clear();
          localStorage.setItem(
            `amne:check-gate:${key}:common`,
            JSON.stringify({ status: "passed", attempts: 2 }),
          );
          localStorage.setItem(
            `amne:check-gate:${key}:task-${index}`,
            JSON.stringify({ status: "passed", attempts: 1 }),
          );
        }, { key: participantKey, index: taskIndex });
        await view.goto(`${origin}/task/${taskIndex}`, { waitUntil: "domcontentloaded" });

        const session = sessions[taskIndex - 1];
        const expectedMode = session.condition === "direct"
          ? "In this task, you talk to the other participant yourself."
          : "Your AI Proxy negotiates on your behalf.";
        const expectedScenario = session.taskId === "task_a"
          ? "Next Quarter's Working Arrangements"
          : "Starting the New Project";
        const expectedRoleCopy = session.taskId === "task_a"
          ? role === "leader"
            ? "You · Team Leader: You told the Director that four office days were possible before discussing it with the team. The Director reported that answer upward, and the team has not been told."
            : "You · Team Member and Client: After your presentation, the Client asked if the Leader could present next time. You have not told the Leader."
          : role === "leader"
            ? "You · Team Leader: You submitted a plan with fewer people than the project needs. It now depends on the Member working four days a week, and the team does not know about the mistake."
            : "You · Team Member and Client: The Client said your last report needed more detail and asked if the Leader could write it next time. You have not told the Leader.";

        const modeCount = await view.evaluate(
          (text) => document.body.innerText.split(text).length - 1,
          expectedMode,
        );
        if (modeCount !== 1) throw new Error(`Expected one mode label, found ${modeCount}`);
        await view.getByRole("button", { name: `Read Task ${taskIndex} briefing`, exact: true }).click();
        await view.getByText(expectedScenario, { exact: true }).waitFor();
        await view.getByRole("button", { name: "Next: your reasons", exact: true }).click();
        await view.getByText(expectedRoleCopy, { exact: true }).waitFor();
        results.push({ policy, role, sequenceId, taskIndex, condition: session.condition, taskId: session.taskId });
        await view.close({ runBeforeUnload: false });
      }
    }
  }

  if (escaped.length > 0) throw new Error(`External requests escaped the mock: ${escaped.join(", ")}`);
  if (cell !== 16 || results.length !== 32) {
    throw new Error(`Incomplete assignment matrix: ${cell} cells, ${results.length} task views`);
  }
  return {
    directCorrection: `${pendingBeforeCorrection} -> ${passedAfterCorrection}`,
    assignmentCells: cell,
    taskViews: results.length,
    externalRequests: escaped.length,
  };
}
