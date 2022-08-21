import {h, This, UseStateActionInput, UseStateDefault} from "../h";
import { children, name, ok, properties, h as f } from "@virtualstate/focus";
import {p, Push} from "@virtualstate/promise";
import { memo } from "@virtualstate/memo";
import { anAsyncThing } from "@virtualstate/promise/the-thing";
import {stateful} from "./stateful";

async function withComponent(input: unknown) {
  let button;

  for await ([button] of children(input)) {
    console.log(button);
    ok(name(button) === "button");

    const { onClick } = properties(button);
    ok(typeof onClick === "function");
  }

  ok(button, "No button");

  const [string, number] = await children(button);
  console.log({ string, number, button });
  ok(typeof string === "string", "Expected string");
  ok(typeof number === "number", "Expected number");
  ok(number === 3, "Expected 3");
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

      yield <button onClick={onClick}>Value {state}</button>;

      lastEffect?.();
      lastEffect = effect();

    } while (state < 3);

    yield <button onClick={onClick}>Value {state}</button>;

    lastEffect?.();
  }
  await withComponent(<ComponentAsync />);

}

{
  const h = f;

  async function *ComponentAsyncStateful() {
    const state = stateful<number>()

    function effect(value?: number) {
      if (!value) {
        state(1)
      } else if (value === 1) {
        state(2);
      } else if (value === 2) {
        state(3)
      }

      return () => {
        console.log({ was: value });
      };
    }

    function onClick() {
      state(value => value + 2);
    }

    yield <button onClick={onClick}>Value</button>

    console.log("Watching state");

    let lastEffect = effect(state.value);

    for await (const value of state) {
      lastEffect?.();
      lastEffect = effect(value);
      yield <button onClick={onClick}>Value {value}</button>;
      if (value >= 3) {
        break;
      }
    }
    lastEffect?.();
    state.close();
  }
  await withComponent(<ComponentAsyncStateful />);

}

{
  const h = f;

  async function *ComponentAsyncStatefulSingleYield() {
    const state = stateful<number>()

    function effect(value?: number) {
      if (!value) {
        state(1)
      } else if (value === 1) {
        state(2);
      } else if (value === 2) {
        state(3)
      }

      return () => {
        console.log({ was: value });
      };
    }

    function onClick() {
      state(value => value + 2);
    }

    yield <button onClick={onClick}>Value {state}</button>

    console.log("Watching state");

    let lastEffect = effect(state.value);

    for await (const value of state) {
      lastEffect?.();
      lastEffect = effect(value);
      if (value >= 3) {
        break;
      }
    }
    lastEffect?.();
    state.close();
  }

  await withComponent(<ComponentAsyncStatefulSingleYield />);

}

{
  const h = f;

  async function *ComponentAsyncStatefulYieldControl() {
    const state = stateful<number>(1)

    function onClick() {
      state(value => value + 2);
    }

    yield <button onClick={onClick}>Value {state}</button>

    for await (const value of state) {
      if (value === 1) {
        state(2);
      } else if (value === 2) {
        state(3)
      }
      if (value >= 3) {
        break;
      }
    }

    state.close();

  }

  await withComponent(<ComponentAsyncStatefulYieldControl />);

}