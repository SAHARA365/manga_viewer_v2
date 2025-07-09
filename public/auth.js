// クッキーに 'auth=' がない場合はログインページへリダイレクト
window.addEventListener('DOMContentLoaded', () => {
  if (!document.cookie.includes('auth=')) {
    window.location.href = '/login';
  }
});
