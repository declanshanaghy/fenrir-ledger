{{/*
Common labels for Odin's Throne
*/}}
{{- define "odin-throne.labels" -}}
app.kubernetes.io/name: odin-throne
app.kubernetes.io/part-of: fenrir-ledger
app.kubernetes.io/component: {{ .component | default "odins-throne" }}
app.kubernetes.io/managed-by: helm
{{- end -}}

{{/*
Selector labels for Odin's Throne
*/}}
{{- define "odin-throne.selectorLabels" -}}
app.kubernetes.io/name: odin-throne
{{- end -}}
