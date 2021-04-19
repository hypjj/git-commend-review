import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

initMixin(Vue)  // Vue实例初始化
stateMixin(Vue) // Vue实例上挂了$data、$props、$del、$set、$watch等方法
eventsMixin(Vue) // Vue实例上挂载$on、$once、$off、$emit等事件
lifecycleMixin(Vue) // Vue实例上添加_update、$forceUpdate、$destroy生命周期函数
renderMixin(Vue) // Vue实例上添加_render、$nextTick方法，并在Vue原型上添加了许多助手函数

export default Vue
