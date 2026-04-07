const frontendHandlerMetadata = new WeakMap<object, Array<{ eventType: string; propertyKey: string }>>()
const popupHandlerMetadata = new WeakMap<object, Array<{ eventType: string; propertyKey: string }>>()

function registerMetadata(
  store: WeakMap<object, Array<{ eventType: string; propertyKey: string }>>,
  target: object,
  eventType: string,
  propertyKey: string
): void {
  const current = store.get(target) ?? []
  current.push({ eventType, propertyKey })
  store.set(target, current)
}

export function FrontendEventHandler<TType extends string>(eventType: TType) {
  return function (
    target: object,
    propertyKey: string,
    _descriptor: PropertyDescriptor
  ): void {
    registerMetadata(frontendHandlerMetadata, target, eventType, propertyKey)
  }
}

export function PopupEventHandler<TType extends string>(eventType: TType) {
  return function (
    target: object,
    propertyKey: string,
    _descriptor: PropertyDescriptor
  ): void {
    registerMetadata(popupHandlerMetadata, target, eventType, propertyKey)
  }
}

export function collectFrontendHandlerMetadata(target: object) {
  return frontendHandlerMetadata.get(Object.getPrototypeOf(target)) ?? []
}

export function collectPopupHandlerMetadata(target: object) {
  return popupHandlerMetadata.get(Object.getPrototypeOf(target)) ?? []
}

