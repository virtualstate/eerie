import { h, This } from "../h";
import { children, name, ok, properties, h as f } from "@virtualstate/focus";

async function withComponent(input: unknown) {
  let button;

  for await ([button] of children(input)) {
    console.log(button);
    ok(name(button) === "button");

    const { onClick } = properties(button);
    ok(typeof onClick === "function");
  }

  ok(button);

  const [string, number] = await children(button);
  console.log({ string, number });
  ok(typeof string === "string");
  ok(typeof number === "number");
  ok(number === 3);
}

{
  function Component(this: This) {
    const { current } = this.useRef(Math.random());

    console.log({ current });

    const [state, setState] = this.useState<number>();

    this.useEffect(() => {
      if (!state) {
        setState(1);
      } else if (state === 1) {
        setState(2);
      } else if (state === 2) {
        setState(3);
      }
      return () => {
        console.log({ was: state });
      };
    }, [state, setState]);

    const callback = this.useCallback(
        function onClick() {
          setState((value) => value + 2);
        },
        [setState]
    );

    const close = this.useClose();

    this.useEffect(() => {
      if (state >= 3) {
        close();
      }
    }, [state, close]);

    return <button onClick={callback}>Value {state}</button>;
  }
  await withComponent(<Component />);
}

{
  function ComponentNamedFunctions(this: This) {
    const { current } = this.useRef(Math.random());


    console.log({ current });

    const [state, setState] = this.useState<number>();
    const close = this.useClose();

    function effect() {
      if (!state) {
        setState(1);
      } else if (state === 1) {
        setState(2);
      } else if (state === 2) {
        setState(3);
      }

      return () => {
        console.log({ was: state });
      };
    }

    function closeEffect() {
      if (state >= 3) {
        close();
      }
    }

    function onClick() {
      setState((value) => value + 2);
    }

    this.useEffect(effect, [state, setState]);
    this.useEffect(closeEffect, [state, close]);

    const callback = this.useCallback(onClick, [setState]);

    return <button onClick={callback}>Value {state}</button>;
  }
  await withComponent(<ComponentNamedFunctions />);
}

{
  const h = f;

  async function *ComponentAsync() {
    let state = 0;
    // const random = Math.random();

    function effect() {
      if (!state) {
        state = 1;
      } else if (state === 1) {
        state = 2;
      } else if (state === 2) {
        state = 3;
      }

      return () => {
        console.log({ was: state });
      };
    }

    function onClick() {
      state += 2;
    }

    let lastEffect;

    do {

      yield <View />

      lastEffect?.();
      lastEffect = effect();

    } while (state < 3);

    yield <View />;

    lastEffect?.();

    function View() {
      return <button onClick={onClick}>Value {state}</button>;
    }
  }
  await withComponent(<ComponentAsync />);

}