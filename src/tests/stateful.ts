import {UseStateActionInput, UseStateDefault} from "../h";
import {Push} from "@virtualstate/promise";
import {ok} from "@virtualstate/focus";

export function stateful<T = unknown>(...args: [UseStateDefault<T>] | []) {
    let value: T;

    const target = new Push<T>({ keep: true });
    function push(input: UseStateActionInput<T>) {
        if (!target.open) return;
        if (isCallbackFn(input)) {
            value = input(value);
        } else {
            value = input;
        }
        target.push(value);
    }

    if (args.length) {
        const [defaultValue] = args;
        push(defaultValue);
    }

    const unknown: object = push;
    define(unknown, target);
    return unknown;

    function isCallbackFn<T = unknown>(
        value: unknown
    ): value is (value: T) => T {
        return typeof value === "function";
    }

    function define(object: object, iterable: AsyncIterable<T>): asserts object is (typeof push) & AsyncIterable<T> & { value?: T, close(): void } {
        ok(typeof object === "function");
        Object.defineProperty(object, Symbol.asyncIterator, {
            value: iterable[Symbol.asyncIterator].bind(iterable)
        });
        Object.defineProperty(object, "value", {
            get() {
                return value;
            }
        })
        Object.defineProperty(object, "close", {
            value: target.close.bind(target)
        });
    }
}