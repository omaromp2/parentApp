<template>
    <div>
        <uApp :toaster="{ position: 'top-right', duration: 3500 }">
            <!-- <NuxtRouteAnnouncer />
            <NuxtWelcome /> -->
            <Form />
        </uApp>
    </div>
</template>

<script>
import Form from "@/components/form.vue";
</script>
