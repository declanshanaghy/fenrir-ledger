{{/*
Common labels for the app
*/}}
{{- define "fenrir-app.labels" -}}
app.kubernetes.io/name: {{ .name | default "fenrir-app" }}
app.kubernetes.io/part-of: fenrir-ledger
app.kubernetes.io/component: {{ .component | default "ledger" }}
app.kubernetes.io/managed-by: helm
{{- end -}}

{{/*
Selector labels for the app
*/}}
{{- define "fenrir-app.selectorLabels" -}}
app.kubernetes.io/name: fenrir-app
{{- end -}}

