import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, spacing } from "../../theme";
import { EmptyState } from "./EmptyState";

export interface PickerItem {
  id: string;
  label: string;
  subtitle?: string;
}

interface BottomSheetPickerProps {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selectedId?: string | null;
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
  placeholder?: string;
}

export const BottomSheetPicker: React.FC<BottomSheetPickerProps> = ({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
  placeholder = "Cari pilihan...",
}) => {
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [items, search]);

  const handleClose = () => {
    setSearch("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.sheetContainer}
            >
              <View style={[styles.sheet, shadows.overlay]}>
                {/* Drag Handle Indicator */}
                <View style={styles.handleWrap}>
                  <View style={styles.handle} />
                </View>

                {/* Header Row */}
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tutup Pilihan"
                    onPress={handleClose}
                    style={styles.closeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={22} color={colors.neutral.textSmall} />
                  </Pressable>
                </View>

                {/* Kolom Pencarian: TIDAK autoFocus agar keyboard tidak langsung menutupi daftar */}
                <View style={styles.searchWrap}>
                  <Ionicons
                    name="search-outline"
                    size={18}
                    color={colors.neutral.textSmall}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder={placeholder}
                    placeholderTextColor={colors.neutral.textSubtle}
                    style={styles.searchInput}
                    autoFocus={false} // Aturan Guideline Bagian 5 & 14: Fokus HANYA saat diketuk
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {search.length > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Hapus pencarian"
                      onPress={() => setSearch("")}
                    >
                      <Ionicons name="close-circle" size={16} color={colors.neutral.textSmall} />
                    </Pressable>
                  )}
                </View>

                {/* Daftar Pilihan */}
                <FlatList
                  data={filteredItems}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.listContent}
                  ListEmptyComponent={
                    <EmptyState
                      type="search_empty"
                      title="Hasil Tidak Ditemukan"
                      message={`Tidak ada pilihan untuk kata kunci "${search}".`}
                      canPerformAction={false}
                    />
                  }
                  renderItem={({ item }) => {
                    const isSelected = item.id === selectedId;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={item.label}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          onSelect(item);
                          handleClose();
                        }}
                        style={({ pressed }) => [
                          styles.itemRow,
                          isSelected && styles.itemRowSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.itemTextWrap}>
                          <Text
                            style={[
                              styles.itemLabel,
                              isSelected && styles.itemLabelSelected,
                            ]}
                          >
                            {item.label}
                          </Text>
                          {item.subtitle ? (
                            <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                          ) : null}
                        </View>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={colors.primary[700]}
                          />
                        )}
                      </Pressable>
                    );
                  }}
                />
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  sheet: {
    backgroundColor: colors.neutral.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    maxHeight: "80%",
    paddingBottom: 24,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.canvas,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.neutral.textPrimary,
    paddingVertical: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.button,
    minHeight: 48,
    marginBottom: 4,
  },
  itemRowSelected: {
    backgroundColor: colors.primary[50],
  },
  itemTextWrap: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  itemLabelSelected: {
    color: colors.primary[800],
  },
  itemSubtitle: {
    fontSize: 12,
    color: colors.neutral.textSmall,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.75,
    backgroundColor: colors.neutral.surfaceHover,
  },
});
