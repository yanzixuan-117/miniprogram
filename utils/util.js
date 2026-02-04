// utils/util.js

/**
 * 格式化时间
 */
var formatTime = function (date) {
  var year = date.getFullYear()
  var month = date.getMonth() + 1
  var day = date.getDate()
  var hour = date.getHours()
  var minute = date.getMinutes()
  var second = date.getSeconds()

  return year + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day + ' ' +
         (hour < 10 ? '0' : '') + hour + ':' + (minute < 10 ? '0' : '') + minute + ':' + (second < 10 ? '0' : '') + second
}

/**
 * 格式化日期
 */
var formatDate = function (date) {
  var year = date.getFullYear()
  var month = date.getMonth() + 1
  var day = date.getDate()

  return year + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day
}

/**
 * 格式化日期为中文
 */
var formatDateCN = function (date) {
  var year = date.getFullYear()
  var month = date.getMonth() + 1
  var day = date.getDate()
  var weekDays = ['日', '一', '二', '三', '四', '五', '六']
  var weekDay = weekDays[date.getDay()]

  return year + '年' + month + '月' + day + '日 星期' + weekDay
}

/**
 * 获取星期几
 */
var getWeekDay = function (dateString) {
  var date = new Date(dateString)
  var weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return weekDays[date.getDay()]
}

/**
 * 获取日期对应的星期数字（0-6）
 */
var getWeekDayNumber = function (dateString) {
  var date = new Date(dateString)
  return date.getDay()
}

/**
 * 显示加载提示
 */
var showLoading = function (title) {
  if (title === undefined || title === null) {
    title = '加载中...'
  }
  wx.showLoading({
    title: title,
    mask: true
  })
}

/**
 * 隐藏加载提示
 */
var hideLoading = function () {
  wx.hideLoading()
}

/**
 * 显示成功提示
 */
var showSuccess = function (title, duration) {
  if (duration === undefined || duration === null) {
    duration = 2000
  }
  wx.showToast({
    title: title,
    icon: 'success',
    duration: duration
  })
}

/**
 * 显示错误提示
 */
var showError = function (title, duration) {
  if (duration === undefined || duration === null) {
    duration = 2000
  }
  wx.showToast({
    title: title,
    icon: 'none',
    duration: duration
  })
}

/**
 * 显示普通提示
 */
var showToast = function (title, icon, duration) {
  if (icon === undefined || icon === null) {
    icon = 'none'
  }
  if (duration === undefined || duration === null) {
    duration = 2000
  }
  wx.showToast({
    title: title,
    icon: icon,
    duration: duration
  })
}

/**
 * 确认对话框
 */
var showConfirm = function (content, title) {
  if (title === undefined || title === null) {
    title = '提示'
  }
  return new Promise(function (resolve, reject) {
    wx.showModal({
      title: title,
      content: content,
      success: function (res) {
        if (res.confirm) {
          resolve(true)
        } else {
          resolve(false)
        }
      },
      fail: function () {
        reject(false)
      }
    })
  })
}

/**
 * 获取用户信息
 */
var getUserInfo = function () {
  return wx.getStorageSync('userInfo') || null
}

/**
 * 保存用户信息
 */
var setUserInfo = function (userInfo) {
  wx.setStorageSync('userInfo', userInfo)
  var app = getApp()
  if (app) {
    app.setUserInfo(userInfo)
  }
}

/**
 * 检查登录状态
 */
var checkLogin = function () {
  var userInfo = getUserInfo()
  if (!userInfo) {
    wx.navigateTo({
      url: '/pages/login/login'
    })
    return false
  }
  return true
}

/**
 * 检查权限
 */
var checkRole = function (requiredRole) {
  var userInfo = getUserInfo()
  if (!userInfo) {
    showError('请先登录')
    wx.navigateTo({
      url: '/pages/login/login'
    })
    return false
  }

  if (requiredRole && userInfo.role !== requiredRole) {
    showError('权限不足')
    return false
  }

  return true
}

/**
 * 是否是教练或管理员
 */
var isCoachOrAdmin = function () {
  var userInfo = getUserInfo()
  if (!userInfo) return false
  return userInfo.role === 'coach' || userInfo.role === 'admin'
}

/**
 * 是否是管理员
 */
var isAdmin = function () {
  var userInfo = getUserInfo()
  if (!userInfo) return false
  return userInfo.role === 'admin'
}

/**
 * 状态文本映射
 */
var bookingStatusMap = {
  'pending': '待审核',
  'confirmed': '已确认',
  'rejected': '已拒绝',
  'completed': '已完成',
  'cancelled': '已取消'
}

/**
 * 获取预约状态文本
 */
var getBookingStatusText = function (status) {
  return bookingStatusMap[status] || status
}

/**
 * 角色文本映射
 */
var roleMap = {
  'student': '学员',
  'coach': '教练',
  'admin': '管理员'
}

/**
 * 获取角色文本
 */
var getRoleText = function (role) {
  return roleMap[role] || role
}

/**
 * 防抖函数
 */
var debounce = function (fn, delay) {
  if (delay === undefined || delay === null) {
    delay = 300
  }
  var timer = null
  return function () {
    var args = arguments
    if (timer) clearTimeout(timer)
    timer = setTimeout(function () {
      fn.apply(this, args)
    }, delay)
  }
}

/**
 * 节流函数
 */
var throttle = function (fn, delay) {
  if (delay === undefined || delay === null) {
    delay = 300
  }
  var last = 0
  return function () {
    var args = arguments
    var now = Date.now()
    if (now - last > delay) {
      last = now
      fn.apply(this, args)
    }
  }
}

/**
 * 数据库操作封装
 */
var db = wx.cloud.database()

/**
 * 查询单条数据
 */
var getOne = function (collection, where) {
  if (where === undefined || where === null) {
    where = {}
  }
  return db.collection(collection).where(where).get()
}

/**
 * 查询列表数据
 */
var getList = function (collection, where, limit, skip) {
  if (where === undefined || where === null) {
    where = {}
  }
  if (limit === undefined || limit === null) {
    limit = 20
  }
  if (skip === undefined || skip === null) {
    skip = 0
  }
  return db.collection(collection)
    .where(where)
    .limit(limit)
    .skip(skip)
    .get()
}

/**
 * 添加数据
 */
var add = function (collection, data) {
  return db.collection(collection).add({
    data: data
  })
}

/**
 * 更新数据
 */
var update = function (collection, id, data) {
  return db.collection(collection).doc(id).update({
    data: data
  })
}

/**
 * 删除数据
 */
var remove = function (collection, id) {
  return db.collection(collection).doc(id).remove()
}

/**
 * 根据ID获取数据
 */
var getById = function (collection, id) {
  return db.collection(collection).doc(id).get()
}

/**
 * 云存储URL缓存
 * 格式: { url: { tempUrl: string, timestamp: number } }
 */
var cloudURLCache = {}

// 缓存有效期（毫秒）设置为1.5小时，避免2小时过期
var CACHE_DURATION = 1.5 * 60 * 60 * 1000

/**
 * 清除云存储URL缓存
 */
var clearCloudURLCache = function () {
  cloudURLCache = {}
}

/**
 * 检查缓存是否有效
 */
var isCacheValid = function (cacheItem) {
  if (!cacheItem || !cacheItem.timestamp) {
    return false
  }
  return Date.now() - cacheItem.timestamp < CACHE_DURATION
}

/**
 * 处理单个云存储图片URL
 * @param {string} url - 原始URL
 * @param {string} defaultUrl - 默认URL，默认为 '/images/avatar.png'
 * @param {boolean} useCache - 是否使用缓存，默认为 true
 * @returns {Promise<string>} 返回处理后的URL
 */
var processCloudImageURL = function (url, defaultUrl, useCache) {
  if (defaultUrl === undefined || defaultUrl === null) {
    defaultUrl = '/images/avatar.png'
  }
  if (useCache === undefined || useCache === null) {
    useCache = true
  }

  // 如果URL为空，返回默认图片
  if (!url || !url.trim()) {
    return Promise.resolve(defaultUrl)
  }

  // 非云存储URL，直接返回
  if (url.indexOf('cloud://') !== 0) {
    return Promise.resolve(url)
  }

  // 如果使用缓存且缓存中存在且未过期，直接返回
  if (useCache && cloudURLCache[url] && isCacheValid(cloudURLCache[url])) {
    return Promise.resolve(cloudURLCache[url].tempUrl)
  }

  // 转换云存储URL
  return wx.cloud.getTempFileURL({
    fileList: [url]
  }).then(function (res) {
    if (res.fileList && res.fileList[0]) {
      var fileData = res.fileList[0]
      if (fileData.status === 0 && fileData.tempFileURL) {
        // 缓存结果（包含时间戳）
        if (useCache) {
          cloudURLCache[url] = {
            tempUrl: fileData.tempFileURL,
            timestamp: Date.now()
          }
        }
        return fileData.tempFileURL
      }
    }
    return defaultUrl
  }).catch(function () {
    return defaultUrl
  })
}

/**
 * 批量处理云存储图片URL
 * @param {Array<string>} urls - URL数组
 * @param {string} defaultUrl - 默认URL
 * @param {boolean} useCache - 是否使用缓存
 * @returns {Promise<Array<string>>} 返回处理后的URL数组
 */
var processCloudImageURLs = function (urls, defaultUrl, useCache) {
  if (!urls || !Array.isArray(urls)) {
    return Promise.resolve([])
  }

  if (defaultUrl === undefined || defaultUrl === null) {
    defaultUrl = '/images/avatar.png'
  }
  if (useCache === undefined || useCache === null) {
    useCache = true
  }

  // 分离需要转换的云存储URL和缓存有效的URL
  var needConvertUrls = []
  var resultUrls = urls.map(function (url) {
    if (!url || !url.trim()) {
      return defaultUrl
    }

    // 非云存储URL，直接返回
    if (url.indexOf('cloud://') !== 0) {
      return url
    }

    // 检查缓存
    if (useCache && cloudURLCache[url] && isCacheValid(cloudURLCache[url])) {
      return cloudURLCache[url].tempUrl
    }

    // 需要转换的URL
    needConvertUrls.push(url)
    return url // 先占位，后面会替换
  })

  // 如果没有需要转换的云存储URL，直接返回
  if (needConvertUrls.length === 0) {
    return Promise.resolve(resultUrls)
  }

  // 批量转换
  return wx.cloud.getTempFileURL({
    fileList: needConvertUrls
  }).then(function (res) {
    var resultMap = {}
    if (res.fileList) {
      res.fileList.forEach(function (fileData) {
        if (fileData.status === 0 && fileData.tempFileURL) {
          if (useCache) {
            cloudURLCache[fileData.fileID] = {
              tempUrl: fileData.tempFileURL,
              timestamp: Date.now()
            }
          }
          resultMap[fileData.fileID] = fileData.tempFileURL
        }
      })
    }

    // 替换原数组中的云存储URL
    return resultUrls.map(function (url) {
      if (url.indexOf('cloud://') === 0 && resultMap[url]) {
        return resultMap[url]
      }
      return url
    })
  }).catch(function () {
    return resultUrls.map(function (url) {
      return url && url.trim() ? url : defaultUrl
    })
  })
}

/**
 * 处理对象中的云存储URL字段
 * @param {Object} obj - 要处理的对象
 * @param {string|Array<string>} fields - 要处理的字段名或字段名数组
 * @param {string} defaultUrl - 默认URL
 * @param {boolean} useCache - 是否使用缓存
 * @returns {Promise<Object>} 返回处理后的对象
 */
var processObjectCloudURLs = function (obj, fields, defaultUrl, useCache) {
  if (!obj || typeof obj !== 'object') {
    return Promise.resolve(obj)
  }

  if (!fields) {
    return Promise.resolve(obj)
  }

  // 统一转换为数组
  var fieldList = typeof fields === 'string' ? [fields] : fields

  // 处理每个字段
  var promises = fieldList.map(function (field) {
    var url = obj[field]
    if (url && typeof url === 'string' && url.indexOf('cloud://') === 0) {
      return processCloudImageURL(url, defaultUrl, useCache).then(function (processedUrl) {
        obj[field] = processedUrl
        return processedUrl
      })
    }
    return Promise.resolve(url)
  })

  return Promise.all(promises).then(function () {
    return obj
  })
}

/**
 * 处理数组中对象的云存储URL字段
 * @param {Array<Object>} list - 对象数组
 * @param {string|Array<string>} fields - 要处理的字段名或字段名数组
 * @param {string} defaultUrl - 默认URL
 * @param {boolean} useCache - 是否使用缓存
 * @returns {Promise<Array<Object>>} 返回处理后的对象数组
 */
var processListCloudURLs = function (list, fields, defaultUrl, useCache) {
  if (!list || !Array.isArray(list)) {
    return Promise.resolve([])
  }

  if (defaultUrl === undefined || defaultUrl === null) {
    defaultUrl = '/images/avatar.png'
  }
  if (useCache === undefined || useCache === null) {
    useCache = true
  }

  var promises = list.map(function (obj) {
    return processObjectCloudURLs(obj, fields, defaultUrl, useCache)
  })

  return Promise.all(promises)
}

/**
 * 格式化时长
 */
var formatDuration = function (seconds) {
  if (!seconds || seconds < 0) return '00:00'
  var totalSeconds = Math.floor(seconds)
  var minutes = Math.floor(totalSeconds / 60)
  var secs = totalSeconds % 60
  return (minutes < 10 ? '0' : '') + minutes + ':' + (secs < 10 ? '0' : '') + secs
}

/**
 * 格式化相对时间
 */
var formatRelativeTime = function (date) {
  if (!date) return ''

  var createTime = date instanceof Date ? date : new Date(date)
  var now = new Date()
  var diff = now.getTime() - createTime.getTime()

  var seconds = Math.floor(diff / 1000)
  var minutes = Math.floor(seconds / 60)
  var hours = Math.floor(minutes / 60)
  var days = Math.floor(hours / 24)

  if (seconds < 60) {
    return '刚刚'
  } else if (minutes < 60) {
    return minutes + '分钟前'
  } else if (hours < 24) {
    return hours + '小时前'
  } else if (days < 7) {
    return days + '天前'
  } else {
    var year = createTime.getFullYear()
    var month = createTime.getMonth() + 1
    var day = createTime.getDate()
    var hour = createTime.getHours()
    var minute = createTime.getMinutes()

    var pad = function (n) {
      return n < 10 ? '0' + n : n
    }

    var currentYear = now.getFullYear()
    if (year === currentYear) {
      return pad(month) + '-' + pad(day) + ' ' + pad(hour) + ':' + pad(minute)
    } else {
      return year + '-' + pad(month) + '-' + pad(day) + ' ' + pad(hour) + ':' + pad(minute)
    }
  }
}

/**
 * 获取难度文本
 */
var getDifficultyText = function (difficulty) {
  var map = {
    '1': '初级',
    '2': '中级',
    '3': '高级',
    '初级': '初级',
    '中级': '中级',
    '高级': '高级'
  }
  return map[difficulty] || '初级'
}

/**
 * 获取难度等级
 */
var getDifficultyLevel = function (difficultyText) {
  var map = {
    '初级': '1',
    '中级': '2',
    '高级': '3'
  }
  return map[difficultyText] || '1'
}

/**
 * 格式化日期文本对象（用于日历卡片显示）
 * @param {Date|string} date - 日期对象或日期字符串
 * @returns {Object} 返回包含 month, day, weekday, full 的对象
 */
var formatDateText = function (date) {
  if (!date) return null

  var d = date instanceof Date ? date : new Date(date)
  var weekDays = ['日', '一', '二', '三', '四', '五', '六']

  return {
    month: d.getMonth() + 1,
    day: d.getDate(),
    weekday: weekDays[d.getDay()],
    full: formatDateCN(d)
  }
}

/**
 * 格式化创建时间（支持绝对和相对时间）
 * @param {Date|string} date - 日期对象或日期字符串
 * @param {string} mode - 显示模式: 'relative' | 'absolute' | 'both'
 * @returns {string} 返回格式化后的时间字符串
 */
var formatCreateTime = function (date, mode) {
  if (!date) return ''

  if (mode === undefined || mode === null) {
    mode = 'relative'
  }

  var d = date instanceof Date ? date : new Date(date)

  if (mode === 'relative') {
    // 相对时间：刚刚、2小时前、3天前
    return formatRelativeTime(d)
  } else if (mode === 'absolute') {
    // 绝对时间：2025-01-15 14:30
    var pad = function (n) {
      return n < 10 ? '0' + n : n
    }
    return d.getFullYear() + '-' +
           pad(d.getMonth() + 1) + '-' +
           pad(d.getDate()) + ' ' +
           pad(d.getHours()) + ':' +
           pad(d.getMinutes())
  } else if (mode === 'both') {
    // 混合模式：相对时间 + 绝对时间
    // 2小时前 (2025-01-15 14:30)
    var pad = function (n) {
      return n < 10 ? '0' + n : n
    }
    var absolute = d.getFullYear() + '-' +
                   pad(d.getMonth() + 1) + '-' +
                   pad(d.getDate()) + ' ' +
                   pad(d.getHours()) + ':' +
                   pad(d.getMinutes())
    return formatRelativeTime(d) + ' (' + absolute + ')'
  }

  return formatRelativeTime(d)
}

/**
 * 格式化时间段
 * @param {string} startTime - 开始时间，格式 "HH:MM"
 * @param {string} endTime - 结束时间，格式 "HH:MM"
 * @returns {string} 返回 "HH:MM-HH:MM" 格式
 */
var formatTimeRange = function (startTime, endTime) {
  if (!startTime || !endTime) return ''
  return startTime + '-' + endTime
}

module.exports = {
  formatTime: formatTime,
  formatDate: formatDate,
  formatDateCN: formatDateCN,
  getWeekDay: getWeekDay,
  getWeekDayNumber: getWeekDayNumber,
  showLoading: showLoading,
  hideLoading: hideLoading,
  showSuccess: showSuccess,
  showError: showError,
  showToast: showToast,
  showConfirm: showConfirm,
  getUserInfo: getUserInfo,
  setUserInfo: setUserInfo,
  checkLogin: checkLogin,
  checkRole: checkRole,
  isCoachOrAdmin: isCoachOrAdmin,
  isAdmin: isAdmin,
  bookingStatusMap: bookingStatusMap,
  getBookingStatusText: getBookingStatusText,
  roleMap: roleMap,
  getRoleText: getRoleText,
  debounce: debounce,
  throttle: throttle,
  db: db,
  getOne: getOne,
  getList: getList,
  add: add,
  update: update,
  remove: remove,
  getById: getById,
  processCloudImageURL: processCloudImageURL,
  processCloudImageURLs: processCloudImageURLs,
  processObjectCloudURLs: processObjectCloudURLs,
  processListCloudURLs: processListCloudURLs,
  clearCloudURLCache: clearCloudURLCache,
  formatDuration: formatDuration,
  formatRelativeTime: formatRelativeTime,
  getDifficultyText: getDifficultyText,
  getDifficultyLevel: getDifficultyLevel,
  formatDateText: formatDateText,
  formatCreateTime: formatCreateTime,
  formatTimeRange: formatTimeRange
}
