import antfu from '@antfu/eslint-config'

export default antfu({
  react: true,
  typescript: true,
  ignores: ['dist', '*.tsbuildinfo'],
}, {
  rules: {
    // 覆盖未导出编辑等场景需要原生确认框
    'no-alert': 'off',
  },
})
