import { expect, test } from "@playwright/test";
import { dragSelect, expectClosed, expectOpen, openScene } from "./helpers";

test.describe("controlled open", () => {
    test("a dismissal wins while the parent keeps open true", async ({
        page,
    }) => {
        await openScene(page, "controlled");
        await dragSelect(page, page.getByTestId("controlled-p"));

        await expectOpen(page, "controlled-status", null);
        await expect(page.getByTestId("controlled-prop")).toHaveText(
            "parent open",
        );

        await page.getByTestId("controlled-item").click();

        await expectClosed(page, "controlled-status", "close-press");
        await expect(page.getByTestId("controlled-prop")).toHaveText(
            "parent open",
        );
        await page.waitForTimeout(300);
        await expect(page.getByTestId("controlled-popup")).toHaveCount(0);
        await expect(page.getByTestId("controlled-status")).toHaveAttribute(
            "data-open",
            "false",
        );
    });

    test("a false-to-true parent transition renews the request", async ({
        page,
    }) => {
        await openScene(page, "controlled");
        await dragSelect(page, page.getByTestId("controlled-p"));
        await expectOpen(page, "controlled-status", null);

        await page.getByTestId("controlled-item").click();
        await expectClosed(page, "controlled-status", "close-press");

        await page.getByTestId("controlled-close").click();
        await expect(page.getByTestId("controlled-prop")).toHaveText(
            "parent closed",
        );
        await expect(page.getByTestId("controlled-status")).toHaveAttribute(
            "data-open",
            "false",
        );

        await page.getByTestId("controlled-open").click();
        await expect(page.getByTestId("controlled-status")).toHaveAttribute(
            "data-open",
            "true",
        );
        await expect(page.getByTestId("controlled-popup")).toBeVisible();
    });

    test("opens after a selection when the parent requested open first", async ({
        page,
    }) => {
        await openScene(page, "controlled");
        await expect(page.getByTestId("controlled-status")).toHaveAttribute(
            "data-open",
            "false",
        );

        await dragSelect(page, page.getByTestId("controlled-p"));

        await expect(page.getByTestId("controlled-status")).toHaveAttribute(
            "data-open",
            "true",
        );
        await expect(page.getByTestId("controlled-popup")).toBeVisible();
    });
});
