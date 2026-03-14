{{/*
Common labels for the app
*/}}
{{- define "fenrir-app.labels" -}}
app.kubernetes.io/name: {{ .name | default "fenrir-app" }}
app.kubernetes.io/part-of: fenrir-ledger
app.kubernetes.io/component: {{ .component | default "frontend" }}
app.kubernetes.io/managed-by: helm
{{- end -}}

{{/*
Selector labels for the app
*/}}
{{- define "fenrir-app.selectorLabels" -}}
app.kubernetes.io/name: fenrir-app
{{- end -}}

{{/*
Common labels for Redis
*/}}
{{- define "fenrir-app.redisLabels" -}}
app.kubernetes.io/name: redis
app.kubernetes.io/part-of: fenrir-ledger
app.kubernetes.io/component: cache
app.kubernetes.io/managed-by: helm
{{- end -}}

{{/*
Selector labels for Redis
*/}}
{{- define "fenrir-app.redisSelectorLabels" -}}
app.kubernetes.io/name: redis
{{- end -}}
