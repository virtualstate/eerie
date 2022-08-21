import {UseStateActionInput, UseStateDefault} from "../h";
import {Push} from "@virtualstate/promise";
import {memo} from "@virtualstate/memo";
import {ok} from "@virtualstate/focus";

export function stateful<T = unknown>(...args: [UseStateDefault<T>] | []) {

    const target = new Push<UseStateActionInput<T>>();
    function push(input: UseStateActionInput<T>) {
        if (!target.open) return;
        target.push(input);
    }

    let value: T;
    if (args.length) {
        const [defaultValue] = args;
        if (isInitFn(defaultValue)) {
            value = defaultValue();
        } else {
            value = defaultValue;
        }
    }

    const iterable: AsyncIterable<T> = {
        async *[Symbol.asyncIterator]() {
            if (args.length) yield value;
            for await (const snapshot of target) {
                if (isCallbackFn(snapshot)) {
                    yield value = snapshot(value);
                } else {
                    yield value = snapshot;
                }
            }
        }
    }

    const unknown: object = push;
    define(unknown, memo(iterable));
    return unknown;

    function isCallbackFn<T = unknown>(
        value: unknown
    ): value is (value: T) => T {
        return typeof value === "function";
    }

    function isInitFn(value: unknown): value is () => T {
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