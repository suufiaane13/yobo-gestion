import { forwardRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import {
  useYoboAlphaInputProps,
  useYoboDecimalInputProps,
  useYoboPinInputProps,
} from './YoboVirtualKeyboard'

type BaseInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  value: string
  onValueChange: (value: string) => void
}

type YoboAlphaInputProps = BaseInputProps & {
  keyboardMaxLength?: number
}

type YoboNumericInputProps = BaseInputProps & {
  variant?: 'pin' | 'decimal'
  keyboardMaxLen?: number
  maskPin?: boolean
}

const YoboNumericInputPin = forwardRef<
  HTMLInputElement,
  BaseInputProps & { keyboardMaxLen: number; maskPin: boolean }
>(function YoboNumericInputPin(
  { value, onValueChange, keyboardMaxLen, maskPin, onPointerDown, ...rest },
  ref,
) {
  const vk = useYoboPinInputProps(value, onValueChange, keyboardMaxLen, maskPin)
  return (
    <input
      {...rest}
      ref={ref}
      type={maskPin ? 'password' : 'text'}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      inputMode="none"
      onFocus={vk.onFocus}
      onPointerDown={(e) => {
        onPointerDown?.(e)
        vk.onPointerDown(e)
      }}
      onPointerUp={vk.onPointerUp}
    />
  )
})

const YoboNumericInputDecimal = forwardRef<HTMLInputElement, BaseInputProps>(function YoboNumericInputDecimal(
  { value, onValueChange, onPointerDown, ...rest },
  ref,
) {
  const vk = useYoboDecimalInputProps(value, onValueChange)
  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      inputMode="none"
      onFocus={vk.onFocus}
      onPointerDown={(e) => {
        onPointerDown?.(e)
        vk.onPointerDown(e)
      }}
      onPointerUp={vk.onPointerUp}
    />
  )
})

export const YoboAlphaInput = forwardRef<HTMLInputElement, YoboAlphaInputProps>(function YoboAlphaInput(
  { value, onValueChange, keyboardMaxLength = 200, onPointerDown, ...rest },
  ref,
) {
  const vk = useYoboAlphaInputProps(value, onValueChange, keyboardMaxLength)
  return (
    <input
      {...rest}
      ref={ref}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      inputMode="none"
      onFocus={vk.onFocus}
      onPointerDown={(e) => {
        onPointerDown?.(e)
        vk.onPointerDown(e)
      }}
      onPointerUp={vk.onPointerUp}
    />
  )
})

type YoboAlphaTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange' | 'inputMode'
> & {
  value: string
  onValueChange: (value: string) => void
  keyboardMaxLength?: number
}

export const YoboAlphaTextarea = forwardRef<HTMLTextAreaElement, YoboAlphaTextareaProps>(function YoboAlphaTextarea(
  { value, onValueChange, keyboardMaxLength = 400, onPointerDown, ...rest },
  ref,
) {
  const vk = useYoboAlphaInputProps(value, onValueChange, keyboardMaxLength)
  return (
    <textarea
      {...rest}
      ref={ref}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      inputMode="none"
      onFocus={vk.onFocus}
      onPointerDown={(e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onPointerDown?.(e as any)
        vk.onPointerDown(e as any)
      }}
      onPointerUp={vk.onPointerUp}
    />
  )
})

export const YoboNumericInput = forwardRef<HTMLInputElement, YoboNumericInputProps>(function YoboNumericInput(
  {
    value,
    onValueChange,
    variant = 'pin',
    keyboardMaxLen = 12,
    maskPin = true,
    onPointerDown,
    ...rest
  },
  ref,
) {
  if (variant === 'decimal') {
    return (
      <YoboNumericInputDecimal
        ref={ref}
        value={value}
        onValueChange={onValueChange}
        onPointerDown={onPointerDown}
        {...rest}
      />
    )
  }
  return (
    <YoboNumericInputPin
      ref={ref}
      value={value}
      onValueChange={onValueChange}
      keyboardMaxLen={keyboardMaxLen}
      maskPin={maskPin}
      onPointerDown={onPointerDown}
      {...rest}
    />
  )
})

