// pages/admin-coach-edit/coach-edit.js
const util = require('../../utils/util.js')

Page({
  data: {
    coachId: '',
    coachInfo: null,
    loading: false,
    saving: false,
    form: {
      name: '',
      nickname: '',
      phone: '',
      specialty: [],
      introduction: '',
      experience: '',
      status: 1
    },
    specialtyOptions: ['青少年培训', '成人训练', '竞技提升', '入门基础', '战术指导', '体能训练']
  },

  onLoad(options) {
    const { id } = options
    if (!id) {
      util.showError('教练ID不存在')
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({ coachId: id })
    this.checkAdminPermission()
    this.loadCoachInfo()
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

  // 加载教练信息
  async loadCoachInfo() {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getCoachInfo',
        data: { coachId: this.data.coachId }
      })

      if (res.result.success && res.result.data) {
        const coach = res.result.data
        this.setData({
          coachInfo: coach,
          form: {
            name: coach.name || '',
            nickname: coach.nickname || '',
            phone: coach.phone || '',
            specialty: coach.specialty || [],
            introduction: coach.introduction || '',
            experience: coach.experience || '',
            status: coach.status !== undefined ? coach.status : 1
          }
        })
      } else {
        util.showError('加载教练信息失败')
      }
    } catch (err) {
      console.error('加载教练信息失败:', err)
      util.showError('加载失败，请重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 表单输入
  onInputChange(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value
    this.setData({
      [`form.${field}`]: value
    })
  },

  // 专长选择
  onSpecialtyChange(e) {
    const specialties = this.data.form.specialty
    const selected = e.currentTarget.dataset.specialty
    const index = specialties.indexOf(selected)

    if (index > -1) {
      // 取消选择
      specialties.splice(index, 1)
    } else {
      // 添加选择（最多3个）
      if (specialties.length < 3) {
        specialties.push(selected)
      } else {
        util.showToast('最多选择3项专长')
        return
      }
    }

    this.setData({
      'form.specialty': specialties
    })
  },

  // 保存
  async save() {
    const { form, coachId } = this.data

    // 表单验证
    if (!form.name || !form.name.trim()) {
      util.showToast('请输入姓名')
      return
    }

    if (!form.nickname || !form.nickname.trim()) {
      util.showToast('请输入昵称')
      return
    }

    this.setData({ saving: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'update',
          coachId: coachId,
          coachData: {
            name: form.name.trim(),
            nickname: form.nickname.trim(),
            phone: form.phone,
            specialty: form.specialty,
            introduction: form.introduction,
            experience: form.experience,
            status: form.status
          }
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
      console.error('保存失败:', err)
      util.showError('保存失败，请重试')
    } finally {
      this.setData({ saving: false })
    }
  },

  // 删除教练
  async deleteCoach() {
    const confirm = await util.showConfirm('确定要删除该教练吗？删除后该用户将失去教练权限。')

    if (!confirm) return

    util.showLoading('删除中...')

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageCoach',
        data: {
          action: 'delete',
          coachId: this.data.coachId
        }
      })

      if (res.result.success) {
        util.showSuccess('删除成功')
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        util.showError(res.result.message || '删除失败')
      }
    } catch (err) {
      console.error('删除失败:', err)
      util.showError('删除失败，请重试')
    } finally {
      util.hideLoading()
    }
  }
})
