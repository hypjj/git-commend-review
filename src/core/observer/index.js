/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    def(value, '__ob__', this)

    // 判断当前值是否为数组，因为我们在vue的响应式数据也可能是数组
    // 且数组的改变在vue2里是不能劫持的，所以这里代理了数组的原型方法中会改变数组的方法
    // 如 push、pop等
    if (Array.isArray(value)) {
      // 判断当前环境是否支持__proto__,以使用不同的劫持策略
      // ie11以下不支持__proto__
      if (hasProto) {  
        // protoAugment会将value的原型指向arrayMethods
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }

      // 上面实现方法代理后数组的元素可以触发依赖了
      // 可是如果我修改的是数组内的数组或对象，也需要代理执行
      // observeArray方法就是遍历value的每一项调用observe
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue // 避免观测vue实例
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 * 定义一个obj下属性的响应式
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean // 是否仅进行浅定义响应式
) {
  const dep = new Dep()

  // 如果对象属性是不可配置的，就不进行响应式处理
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 在对属性设置set\get前，该属性可能已经提前做了set\get处理
  // 如果是则讲之前的处理函数缓存，再从新定义set\get函数里执行，不影响原有的处理
  const getter = property && property.get
  const setter = property && property.set

  // 如果getter存在不会给val赋值，即val是undefined，也就不会触发下面的observe(val) 
  // 因为observe(val)只会在val是对象的时候执行
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // 如果shallow不存在或为false,则进行深度响应式
  let childOb = !shallow && observe(val) 

  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,

    // get就是用来返回正确的属性值，还要为响应式数据做依赖收集
    get: function reactiveGetter () {
      // 获取值
      const value = getter ? getter.call(obj) : val
      // 收集依赖，dep.target就是依赖，target是一个函数
      // 将依赖收集到dep， 如果有childOb，childOb.dep也要收集
      if (Dep.target) { 
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      // 返回值
      return value
    },
    // set用来修改对象属性，接受新值，需要触发当前属性的所有依赖
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // 这里有两个判断成功都不设置新值，只要看第二个
      // 什么时候会出现(newVal !== newVal && value !== value)的情况
      // 当新值和旧值都是NaN时，就会出现这个情况，因为NaN与任何值都不相等，算是一个边界条件吧
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      // 生产环境下用来打印提示信息的
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      // 这个issues的提出原因是，将class作为data传入vue，
      // 导致原本的set和现有的reactiveSetter定义的set重复定义了
      // 所以当有setter时直接返回
      if (getter && !setter) return
      // 如果数据原本有setter，使用原本的setter处理newVal
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 新设置的值可能是个对象或者数组，需要将其转成响应式
      // shallow为true则不用
      childOb = !shallow && observe(newVal)
      // 执行收集的依赖，即通知数据发生了变化
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  // 不能添加无效数据，如undefined null NaN等
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 如果target是数组，使用splice添加，splice已经是被包装过的方法，可以触发数据更新
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  // 如果设置的值在target上且不是原型上的元素，直接改即可，因为对象已经实现了响应式
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  // 执行到这里就说明target是一个新增的元素
  const ob = (target: any).__ob__
  // 当target是vue根实例时，开发环境会报错，因为跟实例的data不是响应式的，不能给跟实例添加元素
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // 不需要时响应式的话就直接赋值就可以返回了
  if (!ob) {
    target[key] = val
    return val
  }
  // 对新增的元素进行响应式处理及依赖执行
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
