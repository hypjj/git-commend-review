/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 * 
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 缓存真正的数组方法
  const original = arrayProto[method]
  // 给arrayMethods添加与原数组同名的方法
  def(arrayMethods, method, function mutator (...args) {
    // 缓存真实数组方法的执行结果并返回，在不影响原数组方法的前提下进行操作
    const result = original.apply(this, args)

    // 获取依赖，之前我们知道data内的每一个数据都会有一个属于自己的闭包__ob__用来存储依赖
    // 代理数组目的就是在数组变动的时候执行依赖
    const ob = this.__ob__

    // 执行依赖之前 我们还要考虑数组被增加的元素
    // 增加的元素此时还不是响应式的，所以我们要获取新增的元素并使其成为响应式
    // 增加的方法只有一下三个，inserted用来储存新增的元素
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        // splice第三个参数及其往后的参数都是要添加的参数
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)

    // notify change 执行依赖
    ob.dep.notify()
    return result
  })
})
