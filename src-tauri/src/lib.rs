#![cfg_attr(mobile, tauri::mobile_entry_point)]

mod authz;
mod commands;
mod db;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_printer_v2::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
      // Plein écran exclusif au lancement (écran entier ; la barre du titre YOBO permet de quitter).
      if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_fullscreen(true);
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::auth::auth_login,
      commands::auth::auth_log_logout,
      commands::cash_session::cash_session_current,
      commands::cash_session::cash_session_current_any,
      commands::cash_session::cash_session_start,
      commands::cash_session::cash_session_close,
      commands::cash_session::cash_sessions_list_closed,
      commands::cash_session::cash_session_open_for_historique,
      commands::catalog::list_catalog,
      commands::catalog_csv::catalog_export_csv_to_documents,
      commands::catalog_csv::catalog_import_csv_pick_dialog,
      commands::database_backup::database_save_backup_dialog,
      commands::database_backup::database_restore_pick_dialog,
      commands::database_purge::database_purge_operational_data,
      commands::database_purge::database_purge_selected_data,
      commands::exports::exports_write_text_file,
      commands::exports::exports_write_bytes_file,
      commands::backups::backups_create_now,
      commands::logs_admin::logs_list,
      commands::logs_admin::logs_list_paged,
      commands::logs_admin::logs_list_for_export,
      commands::logs_admin::logs_db_diagnostics,
      commands::menu::list_categories,
      commands::menu::add_category,
      commands::menu::delete_category,
      commands::menu::reorder_categories,
      commands::menu::reorder_products,
      commands::menu::list_products,
      commands::menu::add_product,
      commands::menu::set_product_active,
      commands::menu::update_product,
      commands::menu::delete_product,
      commands::orders::create_order,
      commands::orders::list_orders,
      commands::orders::orders_gerant_kpis,
      commands::orders::list_orders_gerant_page,
      commands::orders::list_orders_gerant_all,
      commands::orders::orders_cancel,
      commands::orders::orders_list_for_session_ticket,
      commands::orders::get_order_ticket_for_print,
      commands::printers::printers_list,
      commands::printers::printers_print_raw_text,
      commands::printers::printers_print_raw_bytes,
      commands::ticket_settings::get_ticket_public_settings,
      commands::ticket_settings::set_ticket_shop_settings,
      commands::users::list_caissiers,
      commands::users::create_caissier,
      commands::users::set_caissier_active,
      commands::users::reset_caissier_pin,
      commands::users::verify_user_pin,
      commands::users::change_user_password,
      commands::users::get_user_profile,
      commands::users::change_user_name,
      commands::users::verify_any_gerant_pin,
      commands::system::relaunch
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

