import { h as f } from "@virtualstate/focus/h";
import {isAsyncIterable, isPromise} from "./is";
import {anAsyncThing} from "@virtualstate/promise/the-thing";
import {Push} from "@virtualstate/promise";
import {ok} from "@virtualstate/focus";

export function h(source: unknown, options: Record<string | symbol, unknown>, ...children: unknown[]) {
    if (isComponentFn(source)) {
        source = createdHookedComponent(source);
    }
    return f(source, options, ...children);
}

const FunctionToString = Function.prototype.toString;

function isComponentFn(source: unknown): source is ComponentFn {
    if (typeof source !== "function") {
        return false;
    }
    const string = FunctionToString.call(source);
    const isClass = string.startsWith("class ");
    return !isClass;
}

interface ComponentFn<O = Record<string | symbol, unknown>> {
    (this: unknown, options: O, input?: unknown): unknown
}

type UseStateDefault<T> = (() => T) | T;
type UseStateReturn<T> = [T, (value: T) => void];

interface ComponentFnContext {
    useState<T>(defaultValue?: UseStateDefault<T>): UseStateReturn<T>;
    useEffect(...args: unknown[]): void
    useCallback(...args: unknown[]): unknown
    useMemo(...args: unknown[]): unknown
    usePush<T>(value?: T): [Push<T>, (value: T) => void];
}

const UseState = Symbol.for("@virtualstate/eerie/useState");

interface UseStateActionFn<T> {
    (input: ((value: T) => T) | T): void;
}

interface UseStateHookObject<T = unknown> extends AsyncIterable<T>, Iterable<T | UseStateActionFn<T>> {
    0: T;
    1: UseStateActionFn<T>;
    length: 2;
    value: T
    action: UseStateActionFn<T>;
}

type UseStateHook<T = unknown> = [T, UseStateActionFn<T>] & UseStateHookObject<T>;

interface Hook {
    [UseState]?: UseStateHook
}

export type This = ComponentFnContext;

function createdHookedComponent(source: ComponentFn) {
    function isContext(value: unknown): value is ComponentFnContext {
        return typeof value === "object";
    }

    let hooked = false;

    function getHook<K extends keyof Hook, T extends Hook[K]>(
        key: K,
        is: (value: unknown) => value is T,
        create: () => T
    ): T {
        hooked = true;
        hookIndex += 1;
        let hook = hooks.at(hookIndex);
        const existing = hook?.[key];
        if (is(existing)) {
            return existing;
        }
        const created = create();
        hook = {
            ...hook,
            [key]: created
        };
        hooks[hookIndex] = hook;
        return created;
    }

    let hooks: Hook[] = [],
        hookIndex = -1;

    function useState<T>(defaultValue?: UseStateDefault<T>): UseStateReturn<T> {
        return getHook(
            UseState,
            isUseStateHook,
            createHook
        );

        function isInitFn(value: unknown): value is () => T {
            return typeof value === "function";
        }

        function createHook(): UseStateHook<T> {

            const target = new Push<T>({
                keep: true
            });

            let value: T;
            
            if (isInitFn(defaultValue)) {
                value = defaultValue();
            } else {
                value = defaultValue;
            }

            const object: UseStateHookObject<T> = {
                get "0"() {
                    return object.value;
                },
                get "1"() {
                    return object.action;
                },
                length: 2,
                value,
                action(input) {
                    let next: T;
                    if (isCallbackFn(input)) {
                        next = input(value);
                    } else {
                        next = value;
                    }
                },
                [Symbol.asyncIterator]: target[Symbol.asyncIterator].bind(target),
                *[Symbol.iterator]() {
                    yield object.value;
                }
            }
            ok<UseStateHook<T>>(object);
            return object;

            function isCallbackFn(value: unknown): value is (value: T) => T {
                return typeof value === "function";
            }
        }

        function isUseStateHook(value?: UseStateHook<unknown>): value is UseStateHook<T> {
            return !!value;
        }
    }

    function useEffect() {
        hooked = true;
    }

    function useCallback(defaultValue: unknown) {
        hooked = true;
        return defaultValue;
    }

    function useMemo(defaultValue: unknown) {
        hooked = true;
        return defaultValue;
    }

    function usePush<T>(...{ 0: defaultValue, length: args }: [T]) {
        const target = new Push<T>();
        if (args) {
            target.push(defaultValue);
        }
        return [
            target,
            target.push.bind(target)
        ];
    }

    return function HookedComponent(this: unknown, options: Record<string | symbol, unknown>, input: unknown) {

        const context: ComponentFnContext = {
            ...(isContext(this) ? this : undefined),
            useState,
            useEffect,
            useCallback,
            useMemo
        }

        function call() {
            const output = source.call(
                context,
                options,
                input
            );

            ok(!isPromise(output));
            ok(!isAsyncIterable(output));

            return output;
        }

        let output = call();

        if (!hooked) return output;

        return {
            async *[Symbol.asyncIterator]() {




                yield output;




            }
        }
    }
}