# Open Design Helm chart

> Spec §15.5 reference deployment.
> Status: **values surface locked, templates pending.**

This chart is the parameter contract Phase 5 standardised on. The
`templates/` directory is intentionally absent in this slice — the
follow-up PR that lands the Kubernetes manifests will consume the
same `values.yaml` schema.

## Why a placeholder

The plan §6 Phase 5 deliverable is a **single** Helm chart with values
presets per cloud. Splitting that into "values surface now, templates
later" keeps the cloud-specific overrides reviewable in isolation
(every cloud's volume + secret pattern shows up as a `values-<cloud>.yaml`
override file).

## Cloud overrides (planned values files)

```text
values-aws.yaml      persistence.backend=efs       secrets.backend=secrets-manager
values-gcp.yaml      persistence.backend=filestore secrets.backend=secret-manager
values-azure.yaml    persistence.backend=files     secrets.backend=key-vault
values-aliyun.yaml   persistence.backend=nas       secrets.backend=kms
values-tencent.yaml  persistence.backend=cfs       secrets.backend=ssm
values-huawei.yaml   persistence.backend=sfs       secrets.backend=kms
values-self.yaml     persistence.backend=hostPath  secrets.backend=env
```

## Installing once the templates land

```bash
helm repo add open-design https://open-design.ai/charts
helm install od open-design/open-design \
  --set image.tag=edge \
  --set secrets.apiToken="$(openssl rand -hex 32)" \
  -f values-aws.yaml      # one of the cloud overrides above
```
