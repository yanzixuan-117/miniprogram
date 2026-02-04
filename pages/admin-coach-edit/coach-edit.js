// pages/admin-coach-edit/coach-edit.js
const util = require('../../utils/util.js')

Page({
  data: {
    coachId: '',
    formData: {
      name: '',
      avatarUrl: '',
      phone: '',
      specialty: [],
      introduction: '',
      experience: '',
      status: 1
    },
    tagInput: '',
    suggestions: ['网球基础', '发球技术', '接发球', '底线技术', '网前技术', '战术指导', '体能训练', '心理辅导'],
    saving: false,
    loading: false
  },

  onLoad(options) {
    this.checkAdminPermission()

    if (options.id) {
      this.setData({
        coachId: options.id
      })
      this.loadCoachInfo()
    }
  },

  // 检查管理员权限
  checkAdminPermission() {
    const app = getApp()
    if (!app.isAdmin()) {
      wx.showModal({
        title: '权限提示',
        content: '此功能仅限管理员访问',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    }
  },

  // 加载教练信息
  async loadCoachInfo() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'get',
          coachId: this.data.coachId
        }
      })

      if (res.result.success) {
        const coach = res.result.data
        this.setData({
          formData: {
            name: coach.name || '',
            avatarUrl: coach.avatarUrl || '',
            phone: coach.phone || '',
            specialty: coach.specialty || [],
            introduction: coach.introduction || '',
            experience: coach.experience || '',
            status: coach.status !== undefined ? coach.status : 1
          }
        })
      } else {
        util.showError(res.result.message || '加载失败')
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (err) {
      util.showError('加载失败，请重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({
      'formData.avatarUrl': avatarUrl
    })
  },

  // 姓名输入
  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    })
  },

  // 电话输入
  onPhoneInput(e) {
    this.setData({
      'formData.phone': e.detail.value
    })
  },

  // 专长标签输入
  onTagInput(e) {
    this.setData({
      tagInput: e.detail.value
    })
  },

  // 添加标签
  addTag() {
    const tag = this.data.tagInput.trim()
    if (!tag) return

    if (this.data.formData.specialty.length >= 8) {
      util.showToast('最多添加8个专长标签')
      return
    }

    if (this.data.formData.specialty.includes(tag)) {
      util.showToast('该标签已存在')
      return
    }

    this.setData({
      'formData.specialty': [...this.data.formData.specialty, tag],
      tagInput: ''
    })
  },

  // 使用建议标签
  useSuggestion(e) {
    const tag = e.currentTarget.dataset.tag
    if (this.data.formData.specialty.includes(tag)) {
      util.showToast('该标签已存在')
      return
    }

    if (this.data.formData.specialty.length >= 8) {
      util.showToast('最多添加8个专长标签')
      return
    }

    this.setData({
      'formData.specialty': [...this.data.formData.specialty, tag]
    })
  },

  // 删除标签
  removeTag(e) {
    const index = e.currentTarget.dataset.index
    const specialty = [...this.data.formData.specialty]
    specialty.splice(index, 1)
    this.setData({
      'formData.specialty': specialty
    })
  },

  // 简介输入
  onIntroInput(e) {
    this.setData({
      'formData.introduction': e.detail.value
    })
  },

  // 经验输入
  onExperienceInput(e) {
    this.setData({
      'formData.experience': e.detail.value
    })
  },

  // 状态切换
  onStatusChange(e) {
    this.setData({
      'formData.status': e.detail.value ? 1 : 0
    })
  },

  // 保存
  async save() {
    const { formData, coachId } = this.data

    // 验证必填项
    if (!formData.name.trim()) {
      util.showToast('请输入姓名')
      return
    }

    if (formData.specialty.length === 0) {
      util.showToast('请至少添加一个专长标签')
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'update',
          coachId: coachId,
          coachData: formData
        }
      })

      if (res.result.success) {
        util.showSuccess('保存成功')
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        util.showError(res.result.message || '保存失败')
      }
    } catch (err) {
      util.showError('保存失败，请重试')
    } finally {
      wx.hideLoading()
      this.setData({ saving: false })
    }
  }
})
