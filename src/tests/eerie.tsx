import { h, This } from "../h";
import { children, name, ok, properties } from "@virtualstate/focus";

function Component(this: This) {
  const { current } = this.useRef(Math.random());

  console.log({ current });

  const [state, setState] = this.useState<number>();

  this.useEffect(() => {
    if (!state) {
      setState(1);
    }
    if (state === 1) {
      setState(2);
    }
    if (state === 2) {
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

let button;

for await ([button] of children(<Component />)) {
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
