<template>
  <div>
    <table></table>
    <span style="color: #ff4d4f"></span>
  </div>
</template>
<script>
export default {
  methods: {
    save(payload) {
      return this.$http.post('/api/items', payload);
    },
  },
};
</script>
