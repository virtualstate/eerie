import {h, This} from "../h";
import {children} from "@virtualstate/focus";

function Component(this: This) {
    const [state, setState] = this.useState(0);

    this.useEffect(() => {
        if (state === 1) {
            setState(2);
        }
        if (state === 3) {
            setState(4);
        }
    }, [state, setState]);

    const callback = this.useCallback(() => {
        setState(value => value + 1);
    }, [setState]);

    return <button onClick={callback}>Value {state}</button>
}

console.log(await children(<Component />));