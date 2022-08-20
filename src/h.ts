import { h as f } from "@virtualstate/focus/h";
import { isAsyncIterable, isPromise } from "./is";
import { PushFn, p, union } from "@virtualstate/promise";
import { ok } from "@virtualstate/focus";
import {
  createCompositeKey,
  CompositeKeyFn,
} from "@virtualstate/composite-key";

type CompositeKey = ReturnType<CompositeKeyFn>;

export function h(
  source: unknown,
  options: Record<string | symbol, unknown>,
  ...children: unknown[]
) {
  if (isComponentFn(source)) {
    return c(source, options, ...children);
  }
  return f(source, options, ...children);
}

function c(
  source: ComponentFn,
  options: Record<string | symbol, unknown>,
  ...children: unknown[]
) {
  const hooked = createdHookedComponent(source);
  return f(hooked, options, ...children);
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
  (this: unknown, options: O, input?: unknown): unknown;
}

type UseStateDefault<T> = (() => T) | T;
type UseStateActionInput<T> = ((value: T) => T) | T;
interface UseStateActionFn<T> {
  (input: UseStateActionInput<T>): void;
}
type UseStateReturn<T> = readonly [T, UseStateActionFn<T>];

interface EffectReturnFn {
  (): unknown;
}
interface EffectFn {
  (): EffectReturnFn | unknown;
}
type CallbackFn = () => unknown;
interface MemoFn<T> {
  (): T;
}
interface CloseFn {
  (): void;
}

type Dependencies = unknown[];

const HookState = Symbol.for("@virtualstate/eerie/hook/state");

interface ComponentHookState {
  hooked: boolean;
  hooks: Hook[];
  isStateful: boolean;
  isOpen: boolean;
}

interface ReferenceObject<T> {
  current: T;
}

interface ComponentFnContext {
  [HookState]: ComponentHookState;
  useState<T>(defaultValue?: UseStateDefault<T>): UseStateReturn<T>;
  useEffect(fn: EffectFn, dependencies?: Dependencies): void;
  useCallback<Callback extends CallbackFn>(
    fn: Callback,
    dependencies?: Dependencies
  ): Callback;
  useMemo<T>(fn: MemoFn<T>, dependencies?: Dependencies): unknown;
  usePush<T>(value?: T): PushFn<T>;
  useClose(): CloseFn;
  useRef<T>(defaultValue: T): ReferenceObject<T>;
}

const State = Symbol.for("@virtualstate/eerie/state");
const StateValue = Symbol.for("@virtualstate/eerie/state/value");
const StateAction = Symbol.for("@virtualstate/eerie/state/action");
const StateClose = Symbol.for("@virtualstate/eerie/state/close");

const Push = Symbol.for("@virtualstate/eerie/push");
const Effect = Symbol.for("@virtualstate/eerie/effect");
const Callback = Symbol.for("@virtualstate/eerie/callback");
const Memo = Symbol.for("@virtualstate/eerie/memo");

interface UseStateHookObject<T = unknown>
  extends AsyncIterable<UseStateActionInput<T>>,
    Iterable<UseStateReturn<T>[number]> {
  0: T;
  1: UseStateActionFn<T>;
  length: 2;
  [StateValue]: T;
  [StateAction]: UseStateActionFn<T>;
  [StateClose]: CloseFn;
}

type UseStateHook<T = unknown> = UseStateReturn<T> & UseStateHookObject<T>;

interface UseEffectHook {
  effect: EffectFn;
  finalise?: EffectReturnFn;
  dependencies?: Dependencies;
}

interface UseCallbackHook<C extends CallbackFn = CallbackFn> {
  callback: C;
  dependencies?: Dependencies;
}

interface MemoValue<T> {
  value: T;
}

interface UseMemoHook<T = unknown> {
  compositeKey: CompositeKeyFn;
  values: WeakMap<CompositeKey, MemoValue<T>>;
}

interface Hook {
  [State]?: UseStateHook;
  [Push]?: PushFn<unknown>;
  [Effect]?: UseEffectHook[];
  [Callback]?: UseCallbackHook;
  [Memo]?: UseMemoHook;
}

export type This = ComponentFnContext;

function createdHookedComponent(source: ComponentFn) {
  return async function* HookedComponent(
    options: Record<string | symbol, unknown>,
    input: unknown
  ): AsyncIterable<unknown> {
    let hookIndex = -1;

    const context: ComponentFnContext = {
      [HookState]: {
        hooks: [],
        hooked: false,
        isStateful: false,
        isOpen: true,
      },
      useState,
      useEffect,
      useCallback,
      useMemo,
      usePush,
      useClose,
      useRef,
    };

    function useRef<T>(defaultValue: T): ReferenceObject<T> {
      return useMemo(() => ({ current: defaultValue }), []);
    }

    function useHook<K extends keyof Hook, T extends Hook[K]>(
      key: K,
      is: (value: unknown) => value is T,
      create: () => T,
      update?: (hook: T) => T | undefined
    ): T {
      context[HookState].hooked = true;
      hookIndex += 1;
      const { hooks } = context[HookState];
      let hook = hooks.at(hookIndex);
      const existing = hook?.[key];
      if (is(existing)) {
        if (update) {
          const next = update(existing);
          if (next) {
            hook[key] = next;
            return next;
          }
        }
        return existing;
      }
      const created = create();
      hook = {
        ...hook,
        [key]: created,
      };
      hooks[hookIndex] = hook;
      return created;
    }

    function close() {
      if (!context[HookState].isOpen) return;
      context[HookState].isOpen = false;
      const { hooks } = context[HookState];
      for (const hook of hooks) {
        const { [State]: state } = hook;
        if (state) {
          state[StateClose]();
        }
      }
    }

    function useState<T>(defaultValue?: UseStateDefault<T>): UseStateReturn<T> {
      context[HookState].isStateful = true;

      return useHook(State, isState, createState);

      function isInitFn(value: unknown): value is () => T {
        return typeof value === "function";
      }

      function createState(): UseStateHook<T> {
        const target = p();

        let value: T;

        if (isInitFn(defaultValue)) {
          value = defaultValue();
        } else {
          value = defaultValue;
        }

        const object: UseStateHookObject<T> = {
          get "0"() {
            return object[StateValue];
          },
          get "1"() {
            return object[StateAction];
          },
          length: 2,
          [StateValue]: value,
          [StateAction](input) {
            if (target.open) {
              target(input);
            }
          },
          [StateClose]() {
            target.close();
          },
          [Symbol.asyncIterator]: target[Symbol.asyncIterator].bind(target),
          *[Symbol.iterator]() {
            yield object[StateValue];
            yield object[StateAction];
          },
        };
        ok<UseStateHook<T>>(object);
        return object;
      }

      function isState(value?: UseStateHook): value is UseStateHook<T> {
        return !!value;
      }
    }

    function isDependenciesMatch(left?: Dependencies, right?: Dependencies) {
      if (!left?.length) {
        return !right?.length;
      }
      if (!right?.length) return false;
      if (left.length !== right.length) {
        return false;
      }
      return left.every((value, index) => right[index] === value);
    }

    function useEffect(effect: EffectFn, dependencies?: Dependencies) {
      return useHook(Effect, isEffect, createEffect, updateEffect);

      function createEffect() {
        return [
          {
            effect,
            dependencies,
          },
        ];
      }

      function updateEffect(effects: UseEffectHook[]) {
        const last = effects.at(-1);
        ok(last);
        const match = isDependenciesMatch(last.dependencies, dependencies);
        // console.log({ match, last: last.dependencies, dependencies });
        if (match) {
          return effects;
        }
        return effects.concat({
          effect,
          dependencies,
        });
      }

      function isEffect(value: unknown): value is UseEffectHook[] {
        return Array.isArray(value);
      }
    }

    function useCallback<C extends CallbackFn>(
      fn: C,
      dependencies?: Dependencies
    ): C {
      const { callback } = useHook(
        Callback,
        isCallbackHook,
        createCallback,
        updateCallback
      );
      return callback;

      function isCallbackHook(
        value?: UseCallbackHook
      ): value is UseCallbackHook<C> {
        return !!value;
      }

      function createCallback(): UseCallbackHook<C> {
        return { callback: fn, dependencies };
      }

      function updateCallback(hook: UseCallbackHook<C>) {
        if (isDependenciesMatch(hook.dependencies, dependencies)) {
          return hook;
        }
        return createCallback();
      }
    }

    function useMemo<T>(fn: MemoFn<T>, dependencies: Dependencies = []): T {
      const { compositeKey, values } = useHook(Memo, isMemoHook, createMemo);
      const key = compositeKey(...dependencies);
      const existing = values.get(key);
      if (existing) {
        return existing.value;
      }
      const value = fn();
      values.set(key, {
        value,
      });
      return value;

      function isMemoHook(value?: UseMemoHook): value is UseMemoHook<T> {
        return !!value;
      }

      function createMemo() {
        return {
          values: new WeakMap(),
          compositeKey: createCompositeKey(),
        };
      }
    }

    function usePush<T>(...{ 0: defaultValue, length: args }: [T]) {
      return useHook(Push, isPushFn, createPushFn);

      function createPushFn(): PushFn<T> {
        const target = p<T>();
        if (args) {
          target(defaultValue);
        }
        return target;
      }

      function isPushFn(value: unknown): value is PushFn<T> {
        return typeof value === "function";
      }
    }

    function useClose() {
      return close;
    }

    let stateIterator: AsyncIterator<void> | undefined = undefined;

    function call() {
      hookIndex = -1;

      const output = source.call(context, options, input);

      ok(!isPromise(output));
      ok(!isAsyncIterable(output));

      return output;
    }

    function getStateHooks() {
      type StatefulHook = Hook & { [State]: UseStateHook };
      const { hooks } = context[HookState];
      return hooks.filter<StatefulHook>(isStatefulHook);

      function isStatefulHook(hook: Hook): hook is StatefulHook {
        return !!hook[State];
      }
    }

    function getEffectHooks() {
      type EffectHook = Hook & { [Effect]: UseEffectHook[] };
      const { hooks } = context[HookState];
      return hooks.filter<EffectHook>(isEffectHook);

      function isEffectHook(hook: Hook): hook is EffectHook {
        return !!hook[Effect];
      }
    }

    async function* stateful(): AsyncIterable<void> {
      for await (const snapshot of union(
        getStateHooks().map(async function* mapState({ [State]: state }) {
          for await (const value of state) {
            yield [state, value] as const;
          }
        })
      )) {
        for (const [state, input] of snapshot) {
          // The actual commit
          const [current] = state;
          let value;
          if (isCallbackFn(input)) {
            value = input(current);
          } else {
            value = input;
          }
          state[StateValue] = value;
          const [newState] = state;
          ok(newState === value);
        }
        yield;
      }

      function isCallbackFn<T = unknown>(
        value: unknown
      ): value is (value: T) => T {
        return typeof value === "function";
      }
    }

    const effects = new WeakSet(),
      finalised = new WeakSet();

    let output;

    do {
      output = call();

      const { hooked, isStateful, isOpen } = context[HookState];

      if (!isOpen) {
        return;
      }

      if (!hooked) {
        return yield output;
      }


      let statePromise;

      if (isStateful) {
        stateIterator = stateIterator ?? stateful()[Symbol.asyncIterator]();
        statePromise = stateIterator.next();
      }

      for (const hook of getEffectHooks()) {
        const { [Effect]: effect } = hook;
        const previous = effect.at(-2);
        const current = effect.at(-1);
        if (!effects.has(current)) {
          effects.add(current);
          if (previous?.finalise) {
            if (!finalised.has(previous)) {
              const returned = previous.finalise();
              if (isPromise(returned)) {
                await returned;
              }
              finalised.add(previous);
            }
          } else if (previous) {
            finalised.add(previous);
          }
          let returned = current.effect();
          if (isPromise(returned)) {
            returned = await returned;
          }
          if (isEffectReturnFn(returned)) {
            current.finalise = returned;
          }
          hook[Effect] = hook[Effect].filter(
            (effect) => !finalised.has(effect)
          );
        }
      }

      yield output;

      if (!isStateful) return;

      await statePromise;
    } while (context[HookState].isOpen);

    for (const { [Effect]: effects } of getEffectHooks()) {
      for (const effect of effects) {
        if (!finalised.has(effect)) {
          const returned = effect?.finalise?.();
          if (isPromise(returned)) {
            await returned;
          }
        }
      }
    }

    function isEffectReturnFn(value: unknown): value is EffectReturnFn {
      return typeof value === "function";
    }
  };
}
