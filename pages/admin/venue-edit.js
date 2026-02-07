// pages/admin/venue-edit.js
const util = require('../../utils/util.js')

Page({
  data: {
    venueId: '',
    isEdit: false,

    // 表单数据
    name: '',
    address: '',
    description: '',
    imageList: [],
    openTime: '09:00',
    closeTime: '18:00',

    submitting: false,
    loading: false
  },

  onLoad(options) {
    if (!this.checkAdminPermission()) {
      return
    }

    const { id } = options

    if (id) {
      // 编辑模式
      this.setData({
        venueId: id,
        isEdit: true
      })
      this.loadVenueDetail()
    }
  },

  // 检查管理员权限
  checkAdminPermission() {
    const app = getApp()

    // 重新从 storage 加载用户信息以确保数据最新
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      app.globalData.userInfo = userInfo
      app.globalData.userRole = userInfo.role
      app.globalData.displayRole = userInfo.currentRole || userInfo.role
      app.globalData.hasLogin = true
    }

    // 管理员权限检查应该基于实际角色，而不是显示角色
    const actualRole = app.globalData.userRole

    if (actualRole !== 'admin') {
      wx.showModal({
        title: '权限提示',
        content: '此功能仅限管理员访问\n当前角色：' + (actualRole || '未登录'),
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
      return false
    }
    return true
  },

  // 加载球馆详情
  async loadVenueDetail() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageVenues',
        data: {
          action: 'get',
          venueId: this.data.venueId
        }
      })

      if (res.result && res.result.success && res.result.data) {
        const venue = res.result.data

        // 处理 imageList - 需要转换云存储URL
        let imageList = venue.imageList || []

        // 如果有旧格式的 imageUrl，转换成新格式
        if (!imageList.length && venue.imageUrl) {
          imageList = [venue.imageUrl]
        }

        // 使用统一的工具函数批量转换云存储URL
        if (imageList.length > 0) {
          try {
            imageList = await util.processCloudImageURLs(imageList)
          } catch (err) {
          }
        }

        this.setData({
          name: venue.name || '',
          address: venue.address || '',
          description: venue.description || '',
          imageList: imageList,
          openTime: venue.operatingHours?.open || '09:00',
          closeTime: venue.operatingHours?.close || '18:00'
        })
      } else {
        util.showError(res.result?.message || '加载失败')
        wx.navigateBack()
      }
    } catch (err) {
      util.showError('加载失败')
      wx.navigateBack()
    } finally {
      this.setData({ loading: false })
    }
  },

  // 输入球馆名称
  onNameInput(e) {
    this.setData({
      name: e.detail.value
    })
  },

  // 输入地址
  onAddressInput(e) {
    this.setData({
      address: e.detail.value
    })
  },

  // 输入描述
  onDescriptionInput(e) {
    this.setData({
      description: e.detail.value
    })
  },

  // 选择开始时间
  onOpenTimeChange(e) {
    this.setData({
      openTime: e.detail.value
    })
  },

  // 选择结束时间
  onCloseTimeChange(e) {
    this.setData({
      closeTime: e.detail.value
    })
  },

  // 选择图片
  chooseImage() {
    const maxCount = 9 - (this.data.imageList || []).length
    if (maxCount <= 0) {
      util.showToast('最多只能上传9张图片')
      return
    }

    wx.chooseImage({
      count: maxCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths
        this.uploadImages(tempFilePaths)
      }
    })
  },

  // 上传多张图片
  async uploadImages(filePaths) {
    util.showLoading('上传中...')

    try {
      const uploadPromises = filePaths.map(filePath => {
        const cloudPath = `venues/${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`
        return wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: filePath
        })
      })

      const results = await Promise.all(uploadPromises)

      // 筛选成功上传的图片
      const successFiles = results
        .filter(res => {
          return res.errMsg && res.errMsg.includes('ok') && res.fileID
        })
        .map(res => res.fileID)

      if (successFiles.length > 0) {
        // 获取当前图片列表
        let currentList = this.data.imageList || []
        // 合并新图片
        const newList = currentList.concat(successFiles)

        this.setData({
          imageList: newList
        })

        util.showSuccess(`成功上传${successFiles.length}张图片`)
      } else {
        util.showError('图片上传失败，请检查网络连接')
      }

      if (successFiles.length < results.length) {
        util.showToast(`有${results.length - successFiles.length}张图片上传失败`)
      }
    } catch (err) {
      util.showError('上传失败')
    } finally {
      util.hideLoading()
    }
  },

  // 删除图片
  deleteImage(e) {
    const { index } = e.currentTarget.dataset

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张图片吗？',
      success: (res) => {
        if (res.confirm) {
          const imageList = [...this.data.imageList]
          imageList.splice(index, 1)
          this.setData({
            imageList: imageList
          })
        }
      }
    })
  },

  // 预览图片
  previewImage(e) {
    const { index } = e.currentTarget.dataset
    wx.previewImage({
      current: this.data.imageList[index],
      urls: this.data.imageList
    })
  },

  // 选择位置
  chooseLocation() {
    // 检查定位权限
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.userLocation']) {
          // 未授权，请求授权
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => {
              this.openLocationPicker()
            },
            fail: () => {
              wx.showModal({
                title: '需要定位权限',
                content: '需要获取您的位置信息以选择球馆地址，请在设置中开启定位权限',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting()
                  }
                }
              })
            }
          })
        } else {
          // 已授权，直接打开地图
          this.openLocationPicker()
        }
      }
    })
  },

  // 打开地图选择位置
  openLocationPicker() {
    wx.chooseLocation({
      success: (res) => {
        // res.name: 位置名称
        // res.address: 详细地址
        // res.latitude: 纬度
        // res.longitude: 经度

        const address = res.address || res.name || ''

        this.setData({
          address: address
        })

        util.showSuccess('已选择位置')
      },
      fail: (err) => {
        if (err.errMsg.includes('cancel')) {
          // 用户取消，不显示错误
          return
        }
        util.showError('选择位置失败')
      }
    })
  },

  // 验证表单
  validateForm() {
    if (!this.data.name.trim()) {
      util.showToast('请输入球馆名称')
      return false
    }

    if (!this.data.address.trim()) {
      util.showToast('请输入球馆地址')
      return false
    }

    if (!this.data.openTime || !this.data.closeTime) {
      util.showToast('请选择营业时间')
      return false
    }

    // 验证时间是否合理
    if (this.data.openTime >= this.data.closeTime) {
      util.showToast('结束时间必须大于开始时间')
      return false
    }

    return true
  },

  // 提交表单
  async submitForm() {
    if (this.data.submitting) return

    if (!this.validateForm()) {
      return
    }

    this.setData({ submitting: true })

    try {
      util.showLoading('提交中...')

      const venueData = {
        name: this.data.name.trim(),
        address: this.data.address.trim(),
        description: this.data.description.trim(),
        imageList: this.data.imageList || [],
        openTime: this.data.openTime,
        closeTime: this.data.closeTime
      }

      const action = this.data.isEdit ? 'update' : 'add'

      const res = await wx.cloud.callFunction({
        name: 'manageVenues',
        data: {
          action: action,
          venueId: this.data.venueId,
          venueData: venueData
        }
      })

      if (res.result.success) {
        util.showSuccess(this.data.isEdit ? '更新成功' : '添加成功')

        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        util.showError(res.result.message || '提交失败')
      }
    } catch (err) {
      util.showError('提交失败')
    } finally {
      util.hideLoading()
      this.setData({ submitting: false })
    }
  }
})
