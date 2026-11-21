"use client";

import { useActionState } from "react";
import { setupOwner, type SetupState } from "./actions";

const initialState: SetupState = { error: "" };
const field =
  "w-full border-2 border-ink bg-white p-3 text-ink outline-offset-2";

export function SetupForm() {
  const [state, action, pending] = useActionState(setupOwner, initialState);
  return (
    <form action={action} className='mt-6 flex flex-col gap-4'>
      <label className='grid gap-1 text-sm font-bold'>
        Display name
        <input name='name' autoComplete='name' required className={field} />
      </label>
      <label className='grid gap-1 text-sm font-bold'>
        Email
        <input
          name='email'
          type='email'
          autoComplete='email'
          required
          className={field}
        />
      </label>
      <label className='grid gap-1 text-sm font-bold'>
        Password (12+ characters)
        <input
          name='password'
          type='password'
          minLength={12}
          autoComplete='new-password'
          required
          className={field}
        />
      </label>
      <label className='grid gap-1 text-sm font-bold'>
        Owner setup token
        <input
          name='setupToken'
          type='password'
          autoComplete='off'
          required
          className={field}
        />
      </label>
      {state.error && (
        <p
          role='alert'
          className='border-l-4 border-pop-red px-3 text-sm font-semibold'
        >
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className='border-2 border-ink bg-sun px-5 py-3 text-sm font-black shadow-[3px_3px_0_#1b1818] disabled:opacity-50'
      >
        {pending ? "Creating account…" : "Create owner account"}
      </button>
    </form>
  );
}
