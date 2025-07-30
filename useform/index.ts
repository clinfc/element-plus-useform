import AsyncValidator, { type RuleItem, type ValidateError, type ValidateFieldsError } from 'async-validator'
import {
  computed,
  effectScope,
  nextTick,
  reactive,
  ref,
  toRaw,
  unref,
  watch,
  type ComputedGetter,
  type ComputedRef,
  type Ref,
  type WatchHandle,
  type WritableComputedRef,
} from 'vue'

export type Arrayable<T> = T | T[]

export type UseFormPropertyKey = string | number

export type UseFormItemPropertyKey = Arrayable<UseFormPropertyKey>

export interface UseFormModel {
  [K: UseFormPropertyKey]: any
}

export type UseFormRuleItemTrigger = 'blur' | 'change'

export interface UseFormRuleItem extends RuleItem {
  // TODO: trigger
  trigger?: Arrayable<UseFormRuleItemTrigger>
}

export type UseFormRules<T extends UseFormModel = UseFormModel> = {
  [K in keyof T]?: UseFormRuleItem | UseFormRuleItem[]
}

export interface UseFormOptions {
  /**
   * 开启 deep rule 监听
   * @default false
   * @see https://github.com/yiminghe/async-validator?tab=readme-ov-file#deep-rules
   */
  deepRule?: boolean
  /**
   * 严格模式。false: 键不存在时不进行验证；true: 键不存在时仍然进行验证
   * @default false
   */
  strick?: boolean
  /**
   * @default false
   */
  validateOnRuleChange?: boolean
  /**
   * 深度克隆函数
   * @default structuredClone
   * @see https://developer.mozilla.org/zh-CN/docs/Web/API/structuredClone
   */
  cloneDeep?: <T>(value: T) => T
}

export type UseFormValidationResult = Promise<boolean>

export type UseFormValidateCallback = (isValid: boolean, invalidFields?: ValidateFieldsError) => Promise<void> | void

export interface UseFormValidateFailure {
  errors: ValidateError[] | null
  fields: ValidateFieldsError
}

export type UseFormValidateStatus = 'error' | 'validating' | 'success' | ''

export interface UseFormValidateInfo {
  /**
   * 必填项
   */
  required?: boolean
  /**
   * 验证状态
   */
  validateStatus?: UseFormValidateStatus
  /**
   * 错误信息
   */
  error?: string
}

export type UseFormValidateInfos<T extends UseFormModel = UseFormModel> = {
  [key in keyof T]?: UseFormValidateInfo
} & {
  [key: UseFormPropertyKey]: UseFormValidateInfo
}

export interface UseFormResult<
  T extends UseFormModel,
  M extends T | Ref<T>,
  R extends UseFormRules<T> | Ref<UseFormRules<T>> | ComputedRef<UseFormRules<T>> | WritableComputedRef<UseFormRules<T>> | (() => UseFormRules<T>)
> {
  model: M
  rules: R extends ComputedGetter<any> ? ComputedRef<UseFormRules<T>> : R
  initialModel: Ref<T>
  validateInfos: UseFormValidateInfos<T>
  /**
   * 对整个表单的内容进行验证。 接收一个回调函数，或返回 Promise。
   * @see https://element-plus.org/zh-CN/component/form.html#form-exposes
   */
  validate(callback?: UseFormValidateCallback): UseFormValidationResult
  /**
   * 验证具体的某个字段。
   * @see https://element-plus.org/zh-CN/component/form.html#form-exposes
   */
  validateField(props?: Arrayable<UseFormItemPropertyKey>, callback?: UseFormValidateCallback): Promise<any>
  /**
   * 重置表单数据（与 element-plus 不一致）
   * @param newModel 新的 model 数据，默认使用初始值
   */
  resetFields(newModel?: Partial<T>): void
  /**
   * 清除验证信息
   * @param props 需要被清除的验证信息的 key，支持点语法和数组语法。不传入时清除所有验证信息。
   * @see https://element-plus.org/zh-CN/component/form.html#form-exposes
   */
  clearValidate(props?: Arrayable<UseFormItemPropertyKey>): void
  /**
   * 清除深度验证信息及相关监听
   * @param props 需要被清除的深度验证信息的 key，支持点语法和数组语法。不传入时清除所有深度验证信息及相关监听。
   * @param strick true: 取值路径仅最后一级 key 不存在时也会被清除；false: 取值路径仅最后一级 key 不存在时不会被清除
   */
  clearDeepInfos(props?: Arrayable<UseFormItemPropertyKey>, strick?: boolean): void
}

interface GetResult {
  value: any
  exist: boolean
  diff: number
}

export function toArray<T>(value?: T | T[], clone?: boolean): T[] {
  if (Array.isArray(value)) return clone ? value.slice() : value
  if (value === undefined || value === null) return []
  return [value]
}

export function normalizeKey(key: Arrayable<UseFormPropertyKey>, nkc: Record<string | number, string>): string {
  if (typeof key === 'number') return String(key)
  if (Array.isArray(key)) key = key.join('.')
  return nkc[key] ?? (nkc[key] = key.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, ''))
}

export function get(obj: Record<string, any>, key: string): GetResult {
  const keys = key.split('.')
  let value: any = obj
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (k in value) {
      value = value[k]
    } else {
      const d = keys.length - i - 1
      return { value: undefined, exist: d === 0, diff: d }
    }
  }
  return { value, exist: true, diff: 0 }
}

export function isRequired(rule: UseFormRuleItem | UseFormRuleItem[]): boolean {
  return toArray(rule).some((r) => r.required)
}

export function isDeepRule(rule: UseFormRuleItem): boolean {
  return (rule.type === 'object' || rule.type === 'array') && !!(rule.fields || rule.defaultField)
}

function getRuleByDeepRule(key: string, ruleSource: Record<string, UseFormRuleItem | UseFormRuleItem[]>) {
  const keys = key.split('.')
  const rules: UseFormRuleItem[] = []
  for (let i = 0; i < keys.length; i++) {
    let j = i + 1
    let deepRules: UseFormRuleItem[] = toArray(ruleSource[keys.slice(0, j).join('.')])
    while (deepRules.length && j < keys.length) {
      const currentKey = keys[j]
      const currentRuels: UseFormRuleItem[] = []
      for (const rule of deepRules) {
        if (isDeepRule(rule)) {
          currentRuels.push(...toArray(rule.defaultField))
          currentRuels.push(...toArray(rule.fields?.[currentKey]))
        }
      }
      deepRules = currentRuels
      j++
    }
    if (j >= keys.length) {
      rules.push(...deepRules)
    }
  }
  return rules
}

export function useForm<T extends UseFormModel, M extends T = T, R extends UseFormRules<T> = UseFormRules<T>>(
  modelRef: M,
  rulesRef: R,
  options?: UseFormOptions
): UseFormResult<T, M, R>
export function useForm<T extends UseFormModel, M extends T = T, R extends WritableComputedRef<UseFormRules<T>> = WritableComputedRef<UseFormRules<T>>>(
  modelRef: M,
  rulesRef: R,
  options?: UseFormOptions
): UseFormResult<T, M, R>
export function useForm<T extends UseFormModel, M extends T = T, R extends ComputedRef<UseFormRules<T>> = ComputedRef<UseFormRules<T>>>(
  modelRef: M,
  rulesRef: R,
  options?: UseFormOptions
): UseFormResult<T, M, R>
export function useForm<T extends UseFormModel, M extends T = T, R extends ComputedGetter<UseFormRules<T>> = ComputedGetter<UseFormRules<T>>>(
  modelRef: M,
  rulesRef: R,
  options?: UseFormOptions
): UseFormResult<T, M, R>
export function useForm<T extends UseFormModel, M extends T = T, R extends Ref<UseFormRules<T>> = Ref<UseFormRules<T>>>(
  modelRef: M,
  rulesRef: R,
  options?: UseFormOptions
): UseFormResult<T, M, R>

export function useForm<T extends UseFormModel, M extends Ref<T> = Ref<T>, R extends UseFormRules<T> = UseFormRules<T>>(
  modelRef: M,
  rulesRef: R,
  options?: UseFormOptions
): UseFormResult<T, M, R>
export function useForm<T extends UseFormModel, M extends Ref<T> = Ref<T>, R extends WritableComputedRef<UseFormRules<T>> = WritableComputedRef<UseFormRules<T>>>(
  modelRef: M,
  rulesRef: R,
  options?: UseFormOptions
): UseFormResult<T, M, R>
export function useForm<T extends UseFormModel, M extends Ref<T> = Ref<T>, R extends ComputedRef<UseFormRules<T>> = ComputedRef<UseFormRules<T>>>(
  modelRef: M,
  rulesRef: R,
  options?: UseFormOptions
): UseFormResult<T, M, R>
export function useForm<T extends UseFormModel, M extends Ref<T> = Ref<T>, R extends ComputedGetter<UseFormRules<T>> = ComputedGetter<UseFormRules<T>>>(
  modelRef: M,
  rulesRef: R,
  options?: UseFormOptions
): UseFormResult<T, M, R>
export function useForm<T extends UseFormModel, M extends Ref<T> = Ref<T>, R extends Ref<UseFormRules<T>> = Ref<UseFormRules<T>>>(
  modelRef: M,
  rulesRef: R,
  options?: UseFormOptions
): UseFormResult<T, M, R>

export function useForm<T extends UseFormModel, M extends T = T>(modelRef: M, rulesRef?: null, options?: UseFormOptions): UseFormResult<T, M, Ref<UseFormRules<T>>>
export function useForm<T extends UseFormModel, M extends Ref<T> = Ref<T>>(modelRef: M, rulesRef?: null, options?: UseFormOptions): UseFormResult<T, M, Ref<UseFormRules<T>>>

export function useForm<T extends UseFormModel, R extends UseFormRules<T> = UseFormRules<T>>(
  modelRef: null | undefined,
  rulesRef: R,
  options?: UseFormOptions
): UseFormResult<T, Ref<T>, R>
export function useForm<T extends UseFormModel, R extends Ref<UseFormRules<T>> = Ref<UseFormRules<T>>>(
  modelRef: null | undefined,
  rulesRef: R,
  options?: UseFormOptions
): UseFormResult<T, Ref<T>, R>

export function useForm<T extends UseFormModel>(modelRef?: null, rulesRef?: null, options?: UseFormOptions): UseFormResult<T, Ref<T>, Ref<UseFormRules<T>>>

export function useForm<T extends UseFormModel, M extends T | Ref<T> = T | Ref<T>, R extends UseFormRules<T> | Ref<UseFormRules<T>> = UseFormRules<T> | Ref<UseFormRules<T>>>(
  modelRef?: M,
  rulesRef?: R,
  options?: UseFormOptions
): UseFormResult<T, M, R> {
  options ??= {}
  const cloneDeep = options.cloneDeep ?? structuredClone
  const model = (modelRef ?? ref({})) as M
  const rules = (typeof rulesRef === 'function' ? computed(rulesRef) : rulesRef ?? ref({})) as UseFormResult<T, M, R>['rules']

  const initialModel = ref(cloneDeep(toRaw(unref(model)))) as Ref<T>
  const normalizedRules = ref<Record<string, UseFormRuleItem[]>>({})
  const deepRuleKeys = new Map<string, boolean>()
  /** normalized key cache */
  const nkc: Record<string | number, string> = {}
  let watchHandles: Record<string, WatchHandle> = {}

  const _validateInfos: Record<string, UseFormValidateInfo> = reactive({})

  const validateInfos = new Proxy(_validateInfos, {
    get(target, p, receiver) {
      if (typeof p === 'string' && !p.startsWith('__v_')) {
        const key = normalizeKey(p, nkc)
        if (!(key in target) && key.includes('.') && options!.deepRule && !deepRuleKeys.has(key)) {
          const deepRules = getRuleByDeepRule(key, normalizedRules.value)
          if (deepRules.length) {
            setValidateInfo(key, { required: isRequired(deepRules) }, true)
            deepRuleKeys.set(key, true)
            normalizedRules.value[key] = deepRules

            addListeners(key)
          } else {
            deepRuleKeys.set(key, false)
          }
        }

        return Reflect.get(target, key, receiver)
      }
      return Reflect.get(target, p, receiver)
    },
    has(target, p) {
      return Reflect.has(target, p)
    },
  })

  const scope = effectScope()

  function addListeners(props: Arrayable<string>) {
    scope.run(() => {
      toArray(props).forEach((key) => {
        if (!watchHandles[key]) {
          watchHandles[key] = watch(
            () => get(unref(model), key),
            (value) => triggerValidate(key, value)
          )
        }
      })
    })
  }

  function setValidateInfo(key: string, info: UseFormValidateInfo | null, isCreate?: boolean) {
    if (info) {
      isCreate ? (_validateInfos[key] = info) : Object.assign(_validateInfos[key], info)
    } else {
      delete _validateInfos[key]
    }
  }

  function obtainValidateFields(props?: Arrayable<UseFormItemPropertyKey>) {
    const nr = unref(normalizedRules)
    const fileds = toArray(props, true).map((key) => normalizeKey(key, nkc))
    if (fileds.length) return fileds.filter((key) => key in nr)
    const keys = Object.keys(nr)
    return options!.deepRule ? keys.filter((key) => !deepRuleKeys.has(key)) : keys
  }

  async function triggerValidate(key: string, getResult?: GetResult): Promise<boolean> {
    const { value, exist, diff } = getResult || get(unref(model), key)

    if (!exist && (!options!.strick || diff > 1)) {
      setValidateInfo(key, { validateStatus: '', error: undefined })

      if (options!.deepRule) {
        deepRuleKeys.forEach((valid, k) => {
          if (valid && key.startsWith(k) && key !== k) {
            setValidateInfo(k, { validateStatus: '', error: undefined })
          }
        })
      }
      return true
    }

    setValidateInfo(key, { validateStatus: 'validating', error: undefined })

    const deepKeys: string[] = []
    if (options!.deepRule) {
      deepRuleKeys.forEach((valid, k) => {
        if (valid && k.startsWith(key) && key !== k) {
          deepKeys.push(k)
          setValidateInfo(k, { validateStatus: 'validating', error: undefined })
        }
      })
    }

    const validator = new AsyncValidator({ [key]: normalizedRules.value[key] })
    return validator
      .validate({ [key]: value }, { firstFields: true })
      .then(() => {
        setValidateInfo(key, { validateStatus: 'success' })
        deepKeys.forEach((k) => {
          setValidateInfo(k, { validateStatus: 'success' })
        })
        return true
      })
      .catch((err) => {
        const { errors, fields } = err as UseFormValidateFailure
        if (!errors && !fields) {
          console.error(err)
        }
        setValidateInfo(key, key in fields ? { validateStatus: 'error', error: errors?.[0]?.message } : { validateStatus: 'success', error: '' })
        deepKeys.forEach((k) => {
          if (k in fields) setValidateInfo(k, { validateStatus: 'error', error: fields[k][0].message })
          else setValidateInfo(k, { validateStatus: 'success', error: undefined })
        })

        return Promise.reject(fields)
      })
  }

  async function doValidateField(props?: Arrayable<UseFormItemPropertyKey>): Promise<boolean> {
    const fields = obtainValidateFields(props)
    if (fields.length === 0) return true

    const validationErrors: ValidateFieldsError = {}
    for (const field of fields) {
      try {
        await triggerValidate(field)
      } catch (fields) {
        Object.assign(validationErrors, fields)
      }
    }

    if (Object.keys(validationErrors).length === 0) return true
    return Promise.reject(validationErrors)
  }

  const validateField: UseFormResult<T, M, R>['validateField'] = async (props, callback) => {
    const shouldThrow = typeof callback !== 'function'
    try {
      const result = await doValidateField(props)
      // When result is false meaning that the fields are not validatable
      if (result === true) {
        await callback?.(result)
      }
      return result
    } catch (e) {
      if (e instanceof Error) throw e

      const invalidFields = e as ValidateFieldsError

      // if (props.scrollToError) {
      //   scrollToField(Object.keys(invalidFields)[0])
      // }
      await callback?.(false, invalidFields)
      return shouldThrow && Promise.reject(invalidFields)
    }
  }

  const validate: UseFormResult<T, M, R>['validate'] = (callback) => validateField(undefined, callback)

  const resetFields: UseFormResult<T, M, R>['resetFields'] = (newModel) => {
    Object.assign(unref(model), unref(initialModel), newModel)
    nextTick(clearValidate)
  }

  const clearValidate: UseFormResult<T, M, R>['clearValidate'] = (props) => {
    const fields = obtainValidateFields(props)
    fields.forEach((key) => {
      setValidateInfo(key, { validateStatus: '', error: undefined })
    })
    deepRuleKeys.forEach((valid, key) => {
      if (valid && fields.some((f) => key.startsWith(f) && key !== f)) {
        setValidateInfo(key, { validateStatus: '', error: undefined })
      }
    })
  }

  function clearDeepInfo(key: string, strick?: boolean) {
    const { exist, diff } = get(unref(model), key)
    if (!exist && (strick || diff)) {
      setValidateInfo(key, null)
      deepRuleKeys.delete(key)
      watchHandles[key]()
      delete watchHandles[key]
      delete normalizedRules.value[key]
    }
  }

  const clearDeepInfos: UseFormResult<T, M, R>['clearDeepInfos'] = (props, strick) => {
    if (!options!.deepRule) return

    const keys = toArray(props)
    if (keys.length) {
      keys.forEach((key) => {
        key = normalizeKey(key, nkc)
        if (deepRuleKeys.get(key)) {
          clearDeepInfo(key, strick)
        }
      })
    } else {
      deepRuleKeys.forEach((valid, key) => {
        valid && clearDeepInfo(key, strick)
      })
    }
  }

  let isFirst = true

  function updateRules() {
    deepRuleKeys.clear()

    const newRules: Record<string, UseFormRuleItem[]> = (normalizedRules.value = {})

    const oldHandles = watchHandles
    watchHandles = {}

    const listenKeys: string[] = []

    Object.entries(unref(rules)).forEach(([key, rule]) => {
      key = normalizeKey(key, nkc)
      newRules[key] = toArray(rule as UseFormRuleItem, true)

      let isCreate = false

      if (key in oldHandles) {
        watchHandles[key] = oldHandles[key]
      } else {
        isCreate = true
        listenKeys.push(key)
      }

      setValidateInfo(key, { required: isRequired(newRules[key]) }, isCreate)
    })

    Object.keys(oldHandles).forEach((key) => {
      if (!(key in watchHandles)) {
        oldHandles[key]()
        setValidateInfo(key, null)
      }
    })

    addListeners(listenKeys)

    if (!isFirst && options!.validateOnRuleChange) {
      validateField()
    }
    isFirst = false
  }

  watch(rules, updateRules, { immediate: true, deep: true })

  return { model, rules, initialModel, validateInfos, validateField, validate, resetFields, clearValidate, clearDeepInfos }
}
