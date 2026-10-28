<template>
  <div>
    <table>
      <tr>
        <td v-html="row.note"></td>
      </tr>
    </table>
    <div style="margin-top: 8px; padding: 12px"></div>
    <span style="color: #333333"></span>
  </div>
</template>
<script>
export default {
  methods: {
    load() {
      return this.$http.get('/api/items');
    },
  },
};
</script>
