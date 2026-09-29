package expo.modules.latershare

import android.content.Context
import androidx.room.*
import java.util.concurrent.Executors

@Entity(tableName = "shared_items")
data class SharedItem(
    @PrimaryKey val id: String,
    val text: String,
    val createdAt: Long
)

@Dao
interface SharedItemDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    fun insert(item: SharedItem)

    @Query("SELECT * FROM shared_items ORDER BY createdAt DESC")
    fun getAll(): List<SharedItem>
}

@Database(
    entities = [SharedItem::class],
    version = 1,
    exportSchema = false
)
abstract class ShareDatabase : RoomDatabase() {
    abstract fun items(): SharedItemDao

    companion object {
        @Volatile
        private var instance: ShareDatabase? = null

        fun get(context: Context): ShareDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                ShareDatabase::class.java,
                "later.db"
            ).build().also { instance = it }
        }
    }
}

object ShareStorage {
    val executor = Executors.newSingleThreadExecutor()
}