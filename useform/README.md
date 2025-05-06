# @element-plus/useform

对 element-plus 的表单验证扩展，使表单验证可以不依赖 el-form 与 el-form-item，但又能使用 el-form-item 进行校验状态展示。

## 安装

```sh
npm i @element-plus/useform async-validator
```

## 使用

```vue
<template>
  <el-form-item label="标题" v-bind="validateInfos.title">
    <el-input v-model="model.title" />
  </el-form-item>
  <el-form-item label="副标题" v-bind="validateInfos.subtitle">
    <el-input v-model="model.subtitle" />
  </el-form-item>
  <el-form-item>
    <el-button type="primary" @click="onSubmit">submit</el-button>
    <el-button @click="resetFields()">reset</el-button>
  </el-form-item>
</template>

<script setup lang="ts">
import { useForm, type UseFormRules } from '@element-plus/useform'

interface FormState {
  title?: string
  subtitle?: string
}

const rules: UseFormRules<FormState> = {
  title: [
    { required: true, message: '请输入标题' },
    { min: 5, max: 10, message: '标题长度在 5~10 字符' },
  ],
  subtitle: [{ max: 20, message: '副标题长度不超过 20 字符' }],
}

const { model, validateInfos, validate, resetFields } = useForm(reactive({}), rules)

function onSubmit() {
  validate((valid, fields) => {
    if (valid) {
      console.log('submit!', toRaw(model))
    } else {
      console.error('error submit!!', fields)
    }
  })
}
</script>
```

## 类型

```ts

function useForm<T extends UseFormModel,></T>(
    modelRef: T|Ref<T>,
    rulesRef?: UseFormRules<T> | Ref<UseFormRules<T>> | ComputedRef<UseFormRules<T>> | WritableComputedRef<UseFormRules<T>> | (() => UseFormRules<T>),
    options?: UseFormOptions
): UseFormResult<T, M, R>
```

### 入参

| 参数     | 作用         | 必填    | 默认值                           |
| :------- | :----------- | :------ | :------------------------------- |
| modelRef | 表单数据     | `false` | `ref({})`                        |
| rulesRef | 数据验证规则 | `false` | `ref({})`                        |
| options  | 配置项       | `false` | `{ cloneDeep: structuredClone }` |

### 类型

```ts
interface UseFormOptions {
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

interface UseFormResult<
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
```
