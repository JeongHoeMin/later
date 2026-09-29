package expo.modules.latershare

import android.Manifest
import android.app.*
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import java.util.UUID

class ShareReceiverActivity : Activity() {
    private lateinit var requestId: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        requestId = savedInstanceState?.getString("requestId") ?: UUID.randomUUID().toString()

        if (intent.action != Intent.ACTION_SEND || intent.type != "text/plain") {
            finish()
            return;
        }

        val text = intent
            .getCharSequenceExtra(Intent.EXTRA_TEXT)
            ?.toString()
            ?.trim()

        if (text.isNullOrEmpty()) {
            Toast.makeText(this, "공유된 내용이 없어요.", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        val context = applicationContext

        ShareStorage.executor.execute {
            try {
                ShareDatabase.get(context).items().insert(
                    SharedItem(
                        id = requestId,
                        text = text,
                        createdAt = System.currentTimeMillis()
                    )
                )
            } catch (error: Exception) {
                Log.e("LaterShare", "Save failed", error)

                runOnUiThread {
                    Toast.makeText(
                        context,
                        "저장하지 못했어요. 다시 시도해 주세요",
                        Toast.LENGTH_LONG
                    ).show()
                    finish()
                }
                return@execute
            }

            val notified = try {
                notifySaved()
            } catch (error: Exception) {
                Log.e("LaterShare", "Notification failed", error)
                false
            }

            runOnUiThread {
                if (!notified) {
                    Toast.makeText(
                        context,
                        "기기에 저장했어요. 알림은 표시하지 못했어요.",
                        Toast.LENGTH_LONG
                    ).show()
                }
                finish()
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString("requestId", requestId)
        super.onSaveInstanceState(outState)
    }

    private fun notifySaved(): Boolean {
        val manager = getSystemService(NotificationManager::class.java)
        val channelId = "later_saved_items"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    channelId,
                    "저장 완료",
                    NotificationManager.IMPORTANCE_HIGH
                )
            )

            if (
                manager.getNotificationChannel(channelId)?.importance == NotificationManager.IMPORTANCE_NONE
            ) {
                return false
            }
        }
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return false
        }

        if (!manager.areNotificationsEnabled()) return false

        // 라이브러리에서 앱의 MainActivity를 직접 참조하지 않습니다.
        val openApp = packageManager.getLaunchIntentForPackage(packageName)
            ?: return false

        openApp.addFlags(
            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
        )

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, channelId)
        } else {
            Notification.Builder(this)
        }

        manager.notify(
            1001,
            builder
                .setSmallIcon(R.drawable.later_ic_save)
                .setContentTitle("저장 완료")
                .setContentText("공유한 내용을 기기에 저장했어요.")
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .setPriority(Notification.PRIORITY_LOW)
                .build()
        )

        return true
    }
}