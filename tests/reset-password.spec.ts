import { expect, test } from "@playwright/test";

test("an invalid or already-used reset link shows an error page instead of the password form", async ({
  page,
}) => {
  await page.goto(
    "http://127.0.0.1:3000/zh/reset-password?token=already-used-token&email=member%40example.com",
  );

  await expect(page.getByRole("heading", { name: "链接已失效" })).toBeVisible();
  await expect(page.getByLabel("密码", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("确认密码", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "返回登录" })).toBeVisible();
});
