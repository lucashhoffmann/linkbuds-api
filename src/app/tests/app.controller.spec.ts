import { AppController } from '../presentation/app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(() => {
    controller = new AppController();
  });

  it('returns a health greeting', () => {
    expect(controller.getHello()).toBe('Hello World');
  });

  it('echoes messages', () => {
    expect(controller.postMessage('hello')).toEqual({ message: 'hello' });
  });
});
