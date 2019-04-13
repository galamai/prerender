import * as puppeteer from 'puppeteer';

export class RenderResult {
    statusCode: number = 200;
    content: string = '';

    public static BadRequest()
    {
        const result = new RenderResult();
        result.statusCode = 400;
        return result;
    }

    public static Ok(content: string) {
        const result = new RenderResult();
        result.content = content;
        return result;
    }
}

export class RenderOptions {
    timeout = 15000;
    width = 1000;
    height = 1000;
    forcePolyfill = true;
    shadyDOM = true;
    shadyCSS = true;
}

export class PreRender {
    private browser: puppeteer.Browser;

    constructor(browser: puppeteer.Browser) {
        this.browser = browser;
    }

    async render(url: string, options?: RenderOptions | undefined) : Promise<RenderResult>
    {
        if (!options) {
            options = new RenderOptions();
        }
        
        const page = await this.browser.newPage();

        try {
            await page.setViewport({width: options.width, height: options.height, isMobile: false});
            page.evaluateOnNewDocument(`customElements.forcePolyfill = ${options.forcePolyfill}}`);
            page.evaluateOnNewDocument(`ShadyDOM = {force: ${options.shadyDOM}}`);
            page.evaluateOnNewDocument(`ShadyCSS = {shimcssproperties: ${options.shadyCSS}}`);

            let response = await page.goto(
                url, {timeout: options.timeout, waitUntil: 'networkidle0'});
            
            if (!response) {
                console.error('response does not exist.');
                return RenderResult.BadRequest();
            }

            const wait = (await page
                .$eval('meta[name="render:wait"]', (element) => element.getAttribute('content') || '')
                .catch(() => undefined)) == 'true';

            if (wait) {
                await page.waitForSelector('meta[name="render:rendered"]', { timeout: options.timeout }).catch();
            }

            let statusCode = response.status();
            const newStatusCode = await page
                .$eval('meta[name="render:status_code"]', (element) => parseInt(element.getAttribute('content') || ''))
                .catch(() => undefined);

            if (statusCode === 304) {
                statusCode = 200;
            }

            if (statusCode === 200 && newStatusCode) {
                statusCode = newStatusCode;
            }

            await this.removeScripts(page);

            const content = await page.evaluate('document.firstElementChild.outerHTML');
            return RenderResult.Ok(content);

        } catch (e) {
            console.error(e);
            return RenderResult.BadRequest();
        }
        finally {
            await page.close();
        }
    }

    private async removeScripts(page: puppeteer.Page) {
        function remove() {
            const elements = document.querySelectorAll('script:not([type]), script[type*="javascript"], link[rel=import]');
            for (const e of Array.from(elements)) {
              e.remove();
            }
        }
        await page.evaluate(remove);
    }
}