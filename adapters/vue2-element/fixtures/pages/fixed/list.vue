<template>
  <div>
    <el-table>
      <el-table-column>
        <template slot-scope="{ row }">{{ row.note }}</template>
      </el-table-column>
    </el-table>
    <div class="list-spacing"></div>
    <span class="theme-text"></span>
  </div>
</template>
<script>
export default {
  methods: {
    load() {
      return this.itemsApi.list();
    },
  },
};
</script>
<style>
.list-spacing {
  margin-top: 8px;
  padding: 12px;
}
.theme-text {
  color: var(--color-text);
}
</style>
