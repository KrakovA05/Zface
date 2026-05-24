export const store = {
  username: '',
  email: '',
  level: 'green',
  userId: '',
  avatarUrl: '',
  status: '',
  goal: '',
  isAdmin: false,
  referralDiscountPct: 0,
};

export function clearStore() {
  store.username = '';
  store.email = '';
  store.level = 'green';
  store.userId = '';
  store.avatarUrl = '';
  store.status = '';
  store.goal = '';
  store.isAdmin = false;
  store.referralDiscountPct = 0;
  store.refreshBadges = undefined;
}
