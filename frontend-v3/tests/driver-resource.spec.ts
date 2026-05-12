import { expect, test, type Page } from '@playwright/test';

const adminSession = process.env.TL196_ADMIN_SESSION || '';

test.skip(!adminSession, 'Set TL196_ADMIN_SESSION to run driver resource UI smoke tests');

async function loginAsAdmin(page: Page) {
  await page.context().addCookies([{
    name: 'tl196_session',
    value: adminSession,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);

  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({
      id: 1,
      email: 'qa-admin@example.local',
      full_name: 'QA Admin',
      role: 'admin',
      role_display: 'Админ',
    }));
  });
}

test.describe('Штаб найма водителей', () => {
  test('админ видит пульт 3 кнопки без технического шума в первом экране', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page);

    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        if (message.text().includes('was preloaded using link preload but not used')) return;
        problems.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

    await page.route('**/api/hr/hiring-request/submit', async (route) => {
      const request = route.request();
      const body = JSON.parse(request.postData() || '{}');
      await route.continue({
        headers: {
          ...request.headers(),
          'content-type': 'application/json',
          'x-tl196-qa': '1',
        },
        postData: JSON.stringify({
          ...body,
          qa_dry_run: true,
          comment: `[QA_RESOURCE] ${body.comment || ''}`.trim(),
        }),
      });
    });
    await page.route('**/api/hr/avito/prepare-command-from-audit', async (route) => {
      const request = route.request();
      const body = JSON.parse(request.postData() || '{}');
      await route.continue({
        headers: {
          ...request.headers(),
          'content-type': 'application/json',
          'x-tl196-qa': '1',
        },
        postData: JSON.stringify({
          ...body,
          suppress_alert: true,
        }),
      });
    });

    await page.goto('/hr/driver-resource', { waitUntil: 'networkidle' });

    const pult = page.getByTestId('driver-resource-pult');
    await expect(page.getByRole('heading', { name: 'Найм водителей' })).toBeVisible();
    await expect(pult.getByText('Не надо разбираться в аналитике')).toBeVisible();
    await expect(page.getByTestId('what-to-press')).toContainText('Что нажимать');
    await expect(page.getByTestId('what-to-press')).toContainText('Машины стоят, людей не хватает');
    await expect(page.getByTestId('metric-needed-today')).toContainText('Нужно сегодня');
    await expect(page.getByTestId('metric-call-now')).toContainText('Звонить сейчас');
    await expect(page.getByTestId('work-group-wb')).toContainText('Маршруты WB');
    await expect(page.getByTestId('work-group-wb')).toContainText('Рязань, Уфа-Сарапул-Уфа, Екатеринбург и Киров');
    await expect(page.getByTestId('route-card-ryazan_wb')).toContainText('WB · Рязань / Рыбное');
    await expect(page.getByTestId('route-card-sarapul_ufa')).toContainText('WB · Уфа-Сарапул-Уфа');
    await expect(page.getByTestId('route-card-sarapul_ufa')).toContainText('ЖМИ: Нужны водители');
    await expect(page.getByTestId('route-card-sarapul_ufa')).toContainText('Объявления Авито');
    await expect(page.getByTestId('route-card-sarapul_ufa')).toContainText('просм.');
    await expect(page.locator('[data-testid^="route-live-ad-sarapul_ufa-"]').first()).toBeVisible();
    if (await page.getByTestId('ai-audit-btn').count() > 0) {
      const cardAuditResponsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/hr/avito/audit-ad') &&
        response.request().method() === 'POST'
      );
      await page.getByTestId('ai-audit-btn').first().click();
      const cardAuditResponse = await cardAuditResponsePromise;
      expect(cardAuditResponse.ok()).toBeTruthy();
      const cardAuditPayload = await cardAuditResponse.json();
      expect(cardAuditPayload.ok).toBe(true);
    }
    await expect(page.getByTestId('ai-audit-score').first()).toBeVisible();
    await expect(pult.getByRole('button', { name: /Нужны водители/ }).first()).toBeVisible();
    await expect(pult.getByRole('button', { name: /Мало звонков/ }).first()).toBeVisible();
    await expect(pult.getByRole('button', { name: /Стоп набор/ }).first()).toBeVisible();
    await expect(page.getByTestId('hr-details')).toContainText('Подробности и контроль');

    const visibleText = await pult.innerText();
    expect(visibleText).not.toContain('route_code');
    expect(visibleText).not.toContain('needs_review');
    expect(visibleText).not.toContain('Release 1 beta');
    expect(visibleText).not.toContain('confidence');
    expect(visibleText).not.toContain('TTL');
    expect(visibleText).not.toContain('data_quality');

    const ufaCard = page.getByTestId('route-card-sarapul_ufa');
    await expect(ufaCard).toContainText(/Не хватает \d+ водителей|Набор можно проверить/);
    await page.getByTestId('route-review-sarapul_ufa').click();
    const reviewPanel = page.getByTestId('command-review-panel');
    await expect(reviewPanel).toContainText('Что на проверке');
    await expect(reviewPanel).toContainText('Реальные объявления Авито');
    await expect(reviewPanel).toContainText('Источник: свежий snapshot');
    await expect(reviewPanel).toContainText('№');
    await expect(reviewPanel).toContainText('Черновик объявления');
    await expect(reviewPanel).toContainText('деньги не списаны');
    await expect(reviewPanel).toContainText('Водитель C на WB-маршрут, 7500 ₽ за круг');
    await expect(reviewPanel).toContainText('оплата указана');
    await expect(reviewPanel).toContainText('Платное продвижение только после подтверждения');
    if (await reviewPanel.getByTestId('ai-audit-score').count() === 0) {
      const auditResponsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/hr/avito/audit-ad') &&
        response.request().method() === 'POST'
      );
      await reviewPanel.getByTestId('ai-audit-btn').first().click();
      const auditResponse = await auditResponsePromise;
      expect(auditResponse.ok()).toBeTruthy();
      const auditPayload = await auditResponse.json();
      expect(auditPayload.ok).toBe(true);
      expect(auditPayload.ai_audit).toBeTruthy();
      expect(['keep', 'rewrite', 'promote', 'unpublish', 'duplicate']).toContain(auditPayload.ai_audit.recommended_action);
    }
    await expect(reviewPanel.getByTestId('ai-audit-score').first()).toBeVisible();
    await reviewPanel.getByTestId('ai-audit-score').first().click();
    const prepareButton = reviewPanel.getByTestId('ai-prepare-command-btn').first();
    await expect(prepareButton).toBeVisible();
    const prepareResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/hr/avito/prepare-command-from-audit') &&
      response.request().method() === 'POST'
    );
    await prepareButton.click();
    const prepareResponse = await prepareResponsePromise;
    expect(prepareResponse.ok()).toBeTruthy();
    const preparePayload = await prepareResponse.json();
    expect(preparePayload.ok).toBe(true);
    expect(preparePayload.command.status).toBe('needs_review');
    await expect(reviewPanel.getByTestId('ai-prepared-command').first()).toContainText(/команда #\d+/);
    await expect(reviewPanel.getByTestId('avito-command-queue')).toContainText('Очередь действий');
    await reviewPanel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath('driver-resource-review.png'), fullPage: false });

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/hr/hiring-request/submit') &&
      response.request().method() === 'POST'
    );
    await ufaCard.getByRole('button', { name: /Мало звонков/ }).click();
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.dry_run).toBe(true);
    expect(payload.telegram.skipped).toBe(true);
    expect(payload.ad_draft.facts_status).toBe('ready_to_publish');
    expect(payload.ad_draft.text).toContain('7500 ₽ за круг');
    await expect(page.getByText('Заявка отправлена. ИИ собрал команду и черновик объявления.')).toBeVisible();
    await expect(page.getByText('Куда ушло')).toBeVisible();
    await expect(page.getByText(/Команда Авито/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Открыть проверку этой заявки/ })).toBeVisible();
    await expect(page.getByTestId('route-action-sarapul_ufa-quality_problem')).toContainText('Мало звонков');

    await page.screenshot({ path: test.info().outputPath('driver-resource-desktop.png'), fullPage: false });
    expect(problems).toEqual([]);
  });

  test('мобильный пульт помещается без таблицы и горизонтального скролла', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page);

    await page.goto('/hr/driver-resource', { waitUntil: 'networkidle' });

    const pult = page.getByTestId('driver-resource-pult');
    await expect(page.getByRole('heading', { name: 'Найм водителей' })).toBeVisible();
    await expect(page.getByTestId('work-group-wb')).toContainText('Маршруты WB');
    await expect(page.getByTestId('route-card-ryazan_wb')).toContainText('Рязань / WB');
    await expect(page.getByTestId('route-card-sarapul_ufa')).toContainText('Уфа-Сарапул-Уфа');
    await expect(page.getByTestId('route-card-sarapul_ufa')).toContainText('WB · Уфа-Сарапул-Уфа');
    await expect(page.getByTestId('hr-details')).toContainText('Подробности и контроль');
    const visibleText = await pult.innerText();
    expect(visibleText).not.toContain('Дефицит по направлениям');
    expect(visibleText).not.toContain('Рекомендации системы');

    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(430);

    await page.screenshot({ path: test.info().outputPath('driver-resource-mobile.png'), fullPage: false });
  });
});
