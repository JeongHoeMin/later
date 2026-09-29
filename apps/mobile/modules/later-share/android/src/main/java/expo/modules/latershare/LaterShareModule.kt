package expo.modules.latershare

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LaterShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LaterShare")

    AsyncFunction("getItems") {
      val context = appContext.reactContext ?: throw IllegalStateException("React context is unavailable")

      ShareDatabase.get(context).items().getAll().map { item ->
        mapOf(
          "id" to item.id,
          "text" to item.text,
          "createdAt" to item.createdAt
        )
      }
    }
  }
}
