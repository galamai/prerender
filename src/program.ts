import * as Koa from 'koa';
import * as route from 'koa-route';
import * as koaLogger from 'koa-logger';
import * as puppeteer from 'puppeteer';
import { PreRender } from './prerender';

export class Program {
    app: Koa = new Koa();
    private prerender: PreRender | undefined;
    private port = 3000;

    async Main() {
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        this.prerender = new PreRender(browser);
        
        this.app.use(koaLogger());
        
        this.app.use(
            route.get('/_ah/health',
            (ctx: Koa.Context) => ctx.body = 'OK'));

        this.app.use(
            route.get('/render/:url(.*)',
            this.HandleRenderRequest.bind(this)));

        return this.app.listen(this.port, () => {
            console.log(`Listening on port ${this.port}`);
        });
    }

    async HandleRenderRequest(ctx: Koa.Context, requestUrl: string) {
        if (!this.prerender) {
            throw (new Error('No prerender initalized yet.'));
        }

        const result = await this.prerender.render(requestUrl);
        ctx.set('x-renderer', 'prerender');
        ctx.status = result.statusCode;
        ctx.body = result.content;
    }
}

async function uncaughtExceptionListener(error: Error) {
    console.error('Uncaught exception');
    console.error(error);
    process.exit(1);
}

async function unhandledRejectionListener(reason: {} | null | undefined, promise: Promise<any>) {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
}

const program = new Program();
program.Main();

process.on('uncaughtException', uncaughtExceptionListener);
process.on('unhandledRejection', unhandledRejectionListener);