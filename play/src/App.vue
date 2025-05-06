<template>
  <el-card class="form-layout">
    <el-form :model="model" label-width="auto">
      <el-form-item label="文章标题" v-bind="validateInfos.title">
        <el-input v-model="model.title" />
      </el-form-item>
      <el-form-item label="文章类型" v-bind="validateInfos.type">
        <el-radio-group v-model="model.type">
          <el-radio :value="ArticleType.Leading">leading</el-radio>
          <el-radio :value="ArticleType.Trailing">trailing</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="关键字" v-bind="validateInfos.keywords">
        <el-table :data="model.keywords" style="width: 100%">
          <el-table-column label="关键字" width="180">
            <template #default="{ row, $index }">
              <el-form-item v-bind="validateInfos[`keywords.${$index}.name`]">
                <el-input v-model="row.name" />
              </el-form-item>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180">
            <template #default="{ $index }">
              <el-button type="primary" size="small" :text="true" @click="onKeywordRemove($index)">
                移除
              </el-button>
            </template>
          </el-table-column>
          <template #append>
            <el-button type="primary" size="small" :text="true" @click="onKeywordAdd">
              添加
            </el-button>
          </template>
        </el-table>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSubmit">Create</el-button>
        <el-button>Cancel</el-button>
        <el-button @click="clearInfos">清除 deep infos</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { useForm, type UseFormRules } from '@element-plus/useform'
import { reactive, toRaw } from 'vue'

enum ArticleType {
  Leading = 'leading',
  Trailing = 'trailing',
}

interface Keyword {
  name: string
  key: string
}

interface ArticleState {
  title: string
  type: ArticleType
  keywords: Keyword[]
}

const rules: UseFormRules<ArticleState> = {
  title: [
    { required: true, message: '请输入文章标题' },
    { min: 5, max: 10, message: '标题长度在 5~10 字符' },
  ],
  type: [{ required: true, message: '请选择文章类型' }],
  keywords: [
    {
      required: true,
      message: '请添加关键字',
      type: 'array',
      defaultField: {
        type: 'object',
        fields: {
          name: [
            { required: true, message: '请输入关键字' },
            { min: 2, max: 10, message: '关键字长度在 2~10 字符' },
          ],
        },
      },
    },
  ],
}

const {
  model,
  rules: _rules,
  validateInfos,
  validate,
  clearDeepInfos,
} = useForm<Partial<ArticleState>>(reactive({}), reactive(rules), { deepRule: true })

function onKeywordAdd() {
  const keyword: Keyword = { key: Date.now().toString(), name: '' }
  if (model.keywords) model.keywords.push(keyword)
  else model.keywords = [keyword]
}

function onKeywordRemove(i: number) {
  model.keywords!.splice(i, 1)
}

function onSubmit() {
  validate((valid, fields) => {
    if (valid) {
      console.log('submit!', toRaw(model))
    } else {
      console.error('error submit!!', fields)
    }
  })
}

function clearInfos() {
  console.log('清除前', { ...toRaw(validateInfos) })
  clearDeepInfos()
  console.log('清除后', { ...toRaw(validateInfos) })
}
</script>

<style lang="scss">
.form-layout {
  width: 500px;
  margin: auto;

  .el-table__empty-block {
    min-height: unset;
    display: none;
  }
}
</style>
